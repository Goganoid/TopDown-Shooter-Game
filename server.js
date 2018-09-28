var express= require("express");
var app = express();
var server= require("http").Server(app);
var io = require("socket.io").listen(server);
var players={}
//createDecoration("x",3,1,2,stage,false,seg_size)
app.use(express.static(__dirname + '/public'));
app.get("/", function (req,res) {
    res.sendFile(__dirname +"public/index.html")
}); 	

io.sockets.setMaxListeners(20);


server.listen(3000, function () {
    console.log(`Example app listening on ${server.address().port}`);
});