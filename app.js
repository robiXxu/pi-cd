const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const app = express();
const exec = require("child_process").exec;

const basePath = "/home/pi/root/";
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
const port = 5555;

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
app.post("/github-push-webhook", (req, res) => {
  console.log(
    `${req.body.sender.login} updated ${req.body.repository.full_name}`
  );

  console.log(req.body.hook.config.secret);
  if (req.body.hook.config.secret !== webhookSecret) {
    res.sendStatus(401);
    return res.end();
  }

  const projectPath = path.join(basePath, req.body.repository.name);
  fs.access(projectPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
      return res.end();
    }

    // reset local changes if any
    exec(`git -C ${projectPath} reset --hard`, execCallback);
    // ditch local files if any
    exec(`git -C ${projectPath} clean -df`, execCallback);
    // pull latest
    exec(`git -C ${projectPath} pull -f`, execCallback);
    // restart process
    exec(`pm2 restart ${req.body.repository.name}`, execCallback);

    res.sendStatus(200);
    res.end();
  });
});

app.listen(port, () => {
  console.log(`[Pi-CD] listening on ${port}`);
});

const execCallback = (err, stdout, stderr) => {
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  if (err) console.error(err);
};
