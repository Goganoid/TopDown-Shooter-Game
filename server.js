var express= require("express");
var app = express();
var server= require("http").Server(app);
var io = require("socket.io").listen(server);
var Matter = require('matter-js/build/matter.js');
var players={};
var radians = function(degrees) {
    return degrees * (Math.PI / 180);
  };

var ID = function () {
    return '_' + Math.random().toString(36).substr(2, 9);
  };
//createDecoration("x",3,1,2,stage,false,seg_size)
app.use(express.static(__dirname + '/public'));
app.get("/", function (req,res) {
    res.sendFile(__dirname +"public/index.html")
});

io.sockets.setMaxListeners(20);


server.listen(3000, function () {
    console.log(`Example app listening on ${server.address().port}`);
});





var engine = Matter.Engine.create();


// var boxB = Matter.Bodies.rectangle(450, 50, 80, 80);
var ground = Matter.Bodies.rectangle(400, 610, 1000, 32, { isStatic: true });
// ground.friction=0.005;


var playerRadius=44.35;
var movementSpeed=10;
var bulletSpeed=10;


Matter.World.add(engine.world, [ground]);
engine.world.gravity.y = 0;
var gameObjects={bullets:{}};
var t=undefined;
io.on('connection', function (socket) {

    let player=createPlayer(players,socket)
    Matter.Events.on(engine,"collisionStart",function(d){
        // console.log(d.pairs[0].bodyA.label,d.pairs[0].bodyB.label)
        // console.log("#################################")

    });
    // console.log(players)
    if(t!=undefined) clearInterval(t)
    t=setInterval(function(){
        Matter.Engine.update(engine, engine.timing.delta);
    },1000/60)

    socket.on("updatePLayer",function(data){

        Matter.Body.setVelocity(players[socket.id].body,{x:0,y:0})

        players[socket.id].keys.left=data.left;
        players[socket.id].keys.right=data.right;
        players[socket.id].keys.up=data.up;
        players[socket.id].keys.down=data.down;

        let body= players[socket.id].body;
        if (data.right) Matter.Body.setVelocity( body,{x:movementSpeed,y:body.velocity.y});
        if (data.left) Matter.Body.setVelocity(body,{x:-movementSpeed,y:body.velocity.y})
        if (data.up) Matter.Body.setVelocity(body,{x:body.velocity.x,y:-movementSpeed})
        if (data.down) Matter.Body.setVelocity(body,{x:body.velocity.x,y:movementSpeed})
        socket.emit("sendPlayerData",body.position)
    });
    socket.on("spawnBullet",function(data){
        createBullet(socket,data)
    });

    socket.on('disconnect', function () {

        Matter.Composite.remove(engine.world, players[socket.id].body)
        delete players[socket.id];

    })
    });



function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
function createPlayer(players, socket){
    let player = {body:Matter.Bodies.circle(400, 200, playerRadius),id:socket.id,keys:{
        left:false,
        right:false,
        up:false,
        down:false,
    }};
    player.body.inertia=Infinity
    players[player.id]=player;
    Matter.World.add(engine.world, player.body);
    Matter.Body.setPosition(player.body,{x:400,y:200})
    player.body.gameObjectType="player";
    // gameObjects.push(player);
    return player
}

function createBullet(socket,mousePosition){

    let playerBody=players[socket.id].body;
    let angle=Matter.Vector.angle(playerBody.position, mousePosition);
    let shootPoint={
        x:playerBody.position.x+ Math.cos(angle) *(playerRadius+30),
        y:playerBody.position.y+ Math.sin(angle) *(playerRadius+30)
    }
    console.log(shootPoint)
    // console.log(playerBody.position,mousePosition);
    let bullet = {
        body:Matter.Bodies.circle(shootPoint.x,shootPoint.y, 10,{
                // angle: Math.random() * 6.28,
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0,
                restitution: 1,
                time:0
                // endCycle: game.cycle + 90, // life span for a bullet (60 per second)
              }),
        id:socket.id
    }

    bullet.body.gameObjectType="bullet";
    Matter.World.add(engine.world, bullet.body);

    if(!gameObjects.bullets[socket.id]) gameObjects.bullets[socket.id]=[]
    else gameObjects.bullets[socket.id].push(bullet);
    Matter.Body.setVelocity(bullet.body,{x: Math.cos(angle)/500,y:Math.sin(angle)/500})

    socket.emit( "bulletSpawned",{ position:bullet.body.position,velocity:bullet.body.velocity,angle:angle * 180 / Math.PI } )
}
