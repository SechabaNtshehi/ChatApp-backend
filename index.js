import express from 'express'
import { createServer } from 'node:http'

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { Server } from 'socket.io'

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
})

await db.exec(`
    CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
`)

const app = express()
const server = createServer(app)
const io = new Server(server, {
    connectionStateRecovery: {}
})
const PORT = 5555;

const __dirname = dirname(fileURLToPath(import.meta.url))

app.get('/', (req, res) =>{
    res.sendFile(join(__dirname, "index.html"))
})

io.on('connection', async (socket) =>{
    console.log("a user is connected yipee")
    socket.on("chat message", async (msg)=>{
        let result;

        try{
            console.log("result pending")
            result = await db.run("INSERT INTO messages (content) VALUES (?)", msg) 
            console.log("secured")
        }
        catch (e){
            return
        }

        io.emit("chat message", `Message: ${msg}`, result.lastID)
    })

    if(!socket.recovered){
        try{
            await db.each('SELECT id, content FROM messages WHERE id > ?', [socket.handshake.auth.serverOffset || 0],
                (_err, row)=>{
                    socket.emit('chat message', row.content, row.id)
                }
            )
        }
        catch (e) {
            console.log("Something went wrong")
        }
    }
})

server.listen(PORT, ()=>{
    console.log(`Server on at http://localhost:${PORT}`)
})

