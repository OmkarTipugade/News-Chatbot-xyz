const {spawn} = require("child_process");


const runPython = (scriptPath, args = []) => {
  return new Promise((resolve, reject) => {
    const py = spawn("python", [scriptPath, ...args]);

    let data = "";
    let error = "";

    py.stdout.on("data", (chunk) => (data += chunk.toString()));
    py.stderr.on("data", (chunk) => (error += chunk.toString()));

    py.on("close", (code) => {
      if (code !== 0) return reject(error);
      resolve(data.trim());
    });
  });
}

