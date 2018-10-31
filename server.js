var express= require("express");
var app = express();
var server= require("http").Server(app);
var io = require("socket.io").listen(server);
var Matter = require('matter-js/build/matter.js');
var gameObjects={players:{},bullets:{},walls:{},bases:{}};
var players={};

Array.prototype.last=function(){
    // console.log(this[this.length-1])
    return this[this.length-1];
}
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

var base1=createBase({x:200,y:300},130,130,"blue")
var base2=createBase({x:1200,y:300},130,130,"red")
var ground = createWall({x:400,y:610},1000,32);
var ground1 = Matter.Bodies.rectangle(0, 0, 10000, 1, { isStatic: true });
var ground2 = Matter.Bodies.rectangle(0, 0, 1, 10000, { isStatic: true });

var playerRadius=44.35;
var movementSpeed=10;
var bulletSpeed=10;
var bullet;

Matter.World.add(engine.world, [ground1,ground2]);
engine.world.gravity.y = 0;
var t=undefined;
io.on('connection', function (socket) {

    let player=createPlayer(socket);
    socket.on("connected",function(){
        socket.emit("addPlayer",{x:player.body.position.x,y:player.body.position.y,id:player.id,team:player.body.team})
        socket.emit("currentPlayers",allPLayersPositions(socket.id))
        socket.broadcast.emit("addOtherPlayer",{x:player.body.position.x,y:player.body.position.y,id:player.id,team:player.body.team});
       
        let arrayToSend=[];
        let walls=createArrayOfObjects(gameObjects.walls,"wall");
        socket.emit("spawnWall",walls);
        let bases=createArrayOfObjects(gameObjects.bases,"base");
        socket.emit("spawnBase",bases);
    });
    

    Matter.Events.on(engine,"collisionStart",function(event){
        // console.log(event.pairs[0].bodyA.gameObjectType)
        // console.log(event.pairs[0].bodyB.gameObjectType)
        // console.log("###############")
          
            if(event.pairs[0].bodyB.gameObjectType=="bullet") {
                    if(event.pairs[0].bodyA.health) event.pairs[0].bodyA.changeHealthOn(event.pairs[0].bodyB.damage)
                    Matter.Composite.remove(engine.world,event.pairs[0].bodyB) 
            }
            else if(event.pairs[0].bodyA.gameObjectType=="bullet"){
                    if(event.pairs[0].bodyB.health) event.pairs[0].bodyB.changeHealthOn(event.pairs[0].bodyA.damage)
                    Matter.Composite.remove(engine.world,event.pairs[0].bodyA) 
            }
            // if(event.pairs[0].bodyB.gameObjectType=="baseInteractiveRadius"){
            //     if(event.pairs[0].bodyA.gameObjectType=="player") event.pairs[0].bodyA.onBaseRadius=true;
            //     console.log("bodyA.onBaseRadius",event.pairs[0].bodyA.onBaseRadius)
            // }
            // else if(event.pairs[0].bodyA.gameObjectType=="baseInteractiveRadius"){
            //     if(event.pairs[0].bodyB.gameObjectType=="player") event.pairs[0].bodyB.onBaseRadius=true;
            //     console.log("bodyB.onBaseRadius",event.pairs[0].bodyB.onBaseRadius)
            // }
      

    });
    // Matter.Events.on(engine,"collisionStart",function(event){
    //     console.log("end")
    // })
    if(t!=undefined) clearInterval(t)
    t=setInterval(function(){
        Matter.Engine.update(engine, engine.timing.delta);
    },1000/60)

    socket.on("updatePLayer",function(data){

        Matter.Body.setVelocity(gameObjects.players[socket.id].body,{x:0,y:0})

        gameObjects.players[socket.id].keys.left=data.left;
        gameObjects.players[socket.id].keys.right=data.right;
        gameObjects.players[socket.id].keys.up=data.up;
        gameObjects.players[socket.id].keys.down=data.down;

        let body= gameObjects.players[socket.id].body;
        if (data.right) Matter.Body.setVelocity( body,{x:movementSpeed,y:body.velocity.y});
        if (data.left) Matter.Body.setVelocity(body,{x:-movementSpeed,y:body.velocity.y})
        if (data.up) Matter.Body.setVelocity(body,{x:body.velocity.x,y:-movementSpeed})
        if (data.down) Matter.Body.setVelocity(body,{x:body.velocity.x,y:movementSpeed})
        if(bullet!=undefined)io.emit("sendPlayerData",{position:body.position,id:socket.id,b:bullet.body.position});
        else io.emit("sendPlayerData",{position:body.position,id:socket.id});
        // io.emit("sendBulletsData",gameObjects.bullets)
    });
    socket.on("openShop",function(){
        let player=gameObjects.players[socket.id];
        let playerpos=player.body.position;

        let shapes=calculateVertices(gameObjects.bases[player.body.team].body.position.x,
                                     gameObjects.bases[player.body.team].body.position.y,
                                     gameObjects.bases[player.body.team].body.interactiveRadius,
                                     gameObjects.bases[player.body.team].body.interactiveRadius);
        if(playerpos.x>=shapes[0].x && playerpos.x<=shapes[1].x && playerpos.y>=shapes[0].y && playerpos.y<=shapes[2].y) {
            console.log("ok")
        }
    });
    socket.on("spawnBullet",function(data){
        createBullet(socket,data)
    });
    socket.on("spawnWall",function(data){
        createWall(data,100,100)
    });
    
    socket.on('disconnect', function () {

        Matter.Composite.remove(engine.world, gameObjects.players[socket.id].body)
        delete gameObjects.players[socket.id];
        io.emit("removePlayer",socket.id)

    });
    });


  function allPLayersPositions(thisPlayerId){
    let positions={};
    let playersID=Object.keys(gameObjects.players).filter(elem => {return elem!==thisPlayerId});
    playersID.forEach(function(id){
      positions[id]={
        x:gameObjects.players[id].body.position.x,
        y:gameObjects.players[id].body.position.y,
        id:id,
        team:gameObjects.players[id].body.team
      }
    });
    // console.log(positions);
    return positions;
  }
function createPlayer(socket){
    let base=getRandomBase();
    let player = {body:Matter.Bodies.circle(gameObjects.bases[base].body.position.x+200, 200, playerRadius),id:socket.id,keys:{
        left:false,
        right:false,
        up:false,
        down:false,
    }};
  
    player.body.onBaseRadius=false;
    player.body.money=0;
    player.body.team=base;
    console.log(player.body.team,player.body.position)
    player.body.moneyInterval=setInterval(function(){
        player.body.money+=1;
        socket.emit("addMoney",player.body.money)
    },1000);
    player.body.friction=1;
    player.body.inertia=Infinity
    gameObjects.players[player.id]=player;
    Matter.World.add(engine.world, player.body);
    // Matter.Body.setPosition(player.body,{x:400,y:200});
    
    // console.log(player.body.team)
    player.body.health=100;
    player.body.prevHealth=100;

    player.body.changeHealthOn=function(h){
        this.prevHealth-=h/2;
        if(this.prevHealth==this.health-h) {
            this.health-=h;
            if(this.health<=0) {
                io.emit("playerDied",socket.id);
                Matter.Composite.remove(engine.world,player.body);
                delete gameObjects.players[player.id];
            }
            socket.emit("changeHealth",this.health)
        }
      
       
    };
    player.body.gameObjectType="player";
    // gameObjects.push(player);
    return player
}
function createWall(position,w,h){
    let wall = {
        body:Matter.Bodies.rectangle(position.x,position.y, w,h,{
                // angle: Math.random() * 6.28,
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0,
                restitution: 1,
                time:0,
                isStatic:true,
                w:w,
                h:h
                // endCycle: game.cycle + 90, // life span for a bullet (60 per second)
              }),
        id:ID()
    }
    wall.body.gameObjectType="wall";
    Matter.World.add(engine.world, wall.body);
    // if(!gameObjects.walls[socket.id]) gameObjects.walls[socket.id]=[]
    gameObjects.walls[wall.id]=wall
    // console.log(gameObjects.walls)
    io.emit( "spawnWall",{x:wall.body.position.x,y:wall.body.position.y,w:w,h:h} );
    
}
function createBase(position,w,h,team){
    let base = {
        body:Matter.Bodies.rectangle(position.x,position.y, w,h,{
                // angle: Math.random() * 6.28,
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0,
                restitution: 1,
                time:0,
                isStatic:true,
                w:w,
                h:h,
                interactiveRadius:w+200,
                team:team
                                // endCycle: game.cycle + 90, // life span for a bullet (60 per second)
              }),
        id:ID()
    }
    // console.log(base.body.interactiveRadius)
    let interactiveRadius=Matter.Bodies.rectangle(position.x,position.y,w+100,h+100,{
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0,
        restitution: 1,
        time:0,
        isStatic:true,
        isSensor:true,
        w:w,
        h:h
      });
    interactiveRadius.gameObjectType="baseInteractiveRadius";
    base.interactiveRadius=interactiveRadius;
    base.body.gameObjectType="base";
    Matter.World.add(engine.world, [base.body,interactiveRadius]);
    gameObjects.bases[team]=base;

    interactiveRadius.vertices.forEach(function(d){
        // console.log(d.x,d.y)
    });
    console.log(calculateVertices(200,300,230,230))
    // console.log(interactiveRadius.vertices)
    io.emit( "spawnBase",{x:base.body.position.x,y:base.body.position.y,w:w,h:h} );
    return base
    
}
function createBullet(socket,mousePosition){

    let playerBody=gameObjects.players[socket.id].body;
    let angle=Matter.Vector.angle(playerBody.position, mousePosition);
    let shootPoint={
        x:playerBody.position.x+ Math.cos(angle) *(playerRadius+30),
        y:playerBody.position.y+ Math.sin(angle) *(playerRadius+30)
    }
     bullet = {
        body:Matter.Bodies.circle(shootPoint.x,shootPoint.y, 10,{
                // angle: Math.random() * 6.28,
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0,
                restitution: 1,
                time:0
                // endCycle: game.cycle + 90, // life span for a bullet (60 per second)
              }),
        id:ID()
    }
    bullet.body.gameObjectType="bullet";
    bullet.body.damage=10;
    bullet.body.isSensor=true;
    Matter.World.add(engine.world, bullet.body);
    
    if(!gameObjects.bullets[socket.id]) gameObjects.bullets[socket.id]=[]
    else gameObjects.bullets[socket.id].push(bullet);
    Matter.Body.setMass(bullet.body,0.1)
    Matter.Body.setVelocity(bullet.body,{x: Math.cos(angle)*10,y:Math.sin(angle)*10})
    io.emit( "bulletSpawned",{ position:bullet.body.position,velocity:bullet.body.velocity,angle:angle * 180 / Math.PI,id:bullet.id } )
}
function createArrayOfObjects(objects,type){
    let arrayToSend=[]
    Object.keys(objects).forEach(function(id){
        arrayToSend.push({
            x:objects[id].body.position.x,
            y:objects[id].body.position.y,
            w:objects[id].body.w,
            h:objects[id].body.h,
        })
        // console.log(arrayToSend)
        // console.log(arrayToSend[arrayToSend.length-1])
        if(type=="base") arrayToSend.last().radius=objects[id].body.interactiveRadius
    });
    return arrayToSend
}
function calculateVertices(x,y,w,h){
    return [ {x:x-w/2,y:y-h/2},{x:x+w/2,y:y-h/2},{x:x-w/2,y:y+h/2},{x:x+w/2,y:y+h/2}  ] 
}
function getRandomBase(player){
    let r=getRandomInt(0,2);
    if(r==0) return "blue";
    else  return "red";
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }