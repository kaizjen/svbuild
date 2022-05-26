import express from "express";

let app = express()

app.get('*', (req, res) => {
  console.log('sending');
  res.sendFile(req.url, { root: './out' })
})

app.listen(8090, () => {
  console.log('listening');
})
