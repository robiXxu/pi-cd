const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const app = express();
const exec = require("child_process").exec;
const crypto = require("crypto");

const basePath = "/home/pi/root/";
const port = 5555;

const execCallback = (err, stdout, stderr, next) => {
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  if (err) console.error(err);
  if (next && typeof next === "function") next();
};

const createSignature = (body) => {
  const hmac = crypto.createHmac("sha1", process.env.GITHUB_WEBHOOK_SECRET);
  const signature = hmac.update(JSON.stringify(body)).digest("hex");
  return `sha1=${signature}`;
};

const compareSignature = (remoteSignature, localSignature) => {
  const remote = Buffer.from(remoteSignature);
  const local = Buffer.from(localSignature);
  return crypto.timingSafeEqual(remote, local);
};

const verifySignature = (req, res, next) => {
  const { headers, body } = req;

  const remoteSignature = headers["x-hub-signature"];
  if (
    remoteSignature &&
    !compareSignature(remoteSignature, createSignature(body))
  ) {
    return res.status(401).send("Signature mismatch! Get fucked loser!");
  }
  next();
};

const handlePush = (req, res) => {
  console.log(
    `${req.body.sender.login} updated ${req.body.repository.full_name}`
  );

  const projectPath = path.join(basePath, req.body.repository.name);
  fs.access(projectPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
      return res.end();
    }

    // reset local changes if any
    exec(`git -C ${projectPath} reset --hard`, (err, stdout, stderr) =>
      execCallback(err, stdout, stderr, () => {
        // ditch local files if any
        exec(`git -C ${projectPath} clean -df`, (err, stdout, stderr) =>
          execCallback(err, stdout, stderr, () => {
            // pull latest
            exec(`git -C ${projectPath} pull -f`, (err, stdout, stderr) =>
              execCallback(err, stdout, stderr, () => {
                // restart process
                exec(`pm2 restart ${req.body.repository.name}`, execCallback);
              })
            );
          })
        );
      })
    );

    res.sendStatus(200);
    res.end();
  });
};

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.sendStatus(500);
  res.end();
});

app.get("/github-push-webhook", (req, res) => {
  res.sendStatus(200);
  res.end();
});

app.post("/github-push-webhook", verifySignature, handlePush);

app.listen(port, () => {
  console.log(`[Pi-CD] listening on ${port}`);
});
