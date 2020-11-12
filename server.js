//importing
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import multer from 'multer'
import GridFsStorage from 'multer-gridfs-storage'
import Grid from 'gridfs-stream'
import bodyParser from 'body-parser'
import path from 'path'
import Pusher from 'pusher'

import mongoPosts from './mongoPosts.js'

Grid.mongo = mongoose.mongo

//app config
const app = express()
const port = process.env.PORT || 9000

const pusher = new Pusher({
  appId: "1105473",
  key: "a72b66086d9664d6344b",
  secret: "938f050784246017d06e",
  cluster: "ap1",
  useTLS: true
})

//midlewares
app.use(bodyParser.json())
app.use(cors())

//db config
const mongoURI = 'mongodb+srv://admin:6DGtDkOoQbb6xGC6@cluster0.6biph.mongodb.net/fbDb?retryWrites=true&w=majority'

const conn = mongoose.createConnection(mongoURI, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true
})

mongoose.connect(mongoURI, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true
})

mongoose.connection.once('open', ()=> {
  console.log('DB is Connected')

  const changeStream = mongoose.connection.collection('posts').watch()

  changeStream.on('change', (change) => {
    console.log(change);

    if(change.operationType=== "insert"){
      console.log("Pusher is Triggering");

      pusher.trigger('post', 'inserted', {
        change: change
      })
    } else {
      console.log('Error for Triggering Pusher');
    }
  })
})

let gfs

conn.once('open', ()=> {
  console.log('DB Connected')
  
  gfs = Grid(conn.db, mongoose.mongo)
  gfs.collection('images')
})

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject)=>{
      {
        const filename = `image-${Date.now()}${path.extname(file.originalname)}`
      
        const fileInfo = {
          filename: filename,
          bucketName: 'images'
        }
      
        resolve(fileInfo)
      }
    })
  }
})

const upload = multer({storage})

//api routes
app.get('/', (req, res) => res.status(200).send('hello jeffry'))

app.post('/upload/images', upload.single('file'), (req, res) => {
  res.status(201).send(req.file)
})

app.post('/upload/post', (req, res) => {
  const dbPost = req.body 
  
  mongoPosts.create(dbPost, (err, data) => {
    if(err){
      res.status(500).send(err)
    } else{
      res.status(201).send(data)
    }
  })
})

app.get('/retrieve/image/single', (req, res) => {
  gfs.fes.findOne({filename: req.query.name}, (err, file) => {
    if(err){
      res.status(500).send(err)
    } else{
      if(!file || file.length === 0){
       res.status(404).json({err: 'file not found'}) 
      } else{
        
        const readstream = gfs.createReadStream(file.filename)
        readstream.pipe(res)
      }
    }
  })
})

app.get('/retrive/posts', (req, res) => {
  mongoPosts.find((err, data) => {
    if(err){
      res.status(500).send(err)
    } else{
      data.sort((b, a) => {
        return a.timestamp - b.timestamp
      })
      
      res.status(200).send(data)
    }
  })
})

//listen
app.listen(port, () => console.log(`listening on http://localhost:${port}`))