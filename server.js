var express= require("express");
var app = express();
var server= require("http").Server(app);
var io = require("socket.io").listen(server);
var Matter = require('matter-js/build/matter.js');
var gameObjects={players:{},bullets:{},walls:{},bases:{}};
var shopItems={
    "smth1":{
        name:"smth1",
        damage:10,
        coolDown:50,
        canShoot:true,
        price:10,
        sellPrice:5
    },
    "smth2":{
        name:"smth2",
        damage:10,
        coolDown:500,
        canShoot:true,
        price:15,
        sellPrice:8
    },
    "smth3":{
        name:"smth3",
        damage:10,
        coolDown:1000,
        canShoot:true,
        price:5,
        sellPrice:3
    },
    "smth4":{
        name:"smth4",
        damage:10,
        coolDown:1000,
        canShoot:true,
        price:5,
        sellPrice:3
    },
    "smth5":{
        name:"smth5",
        damage:10,
        coolDown:1000,
        canShoot:true,
        price:5,
        sellPrice:3
    },
    "smth6":{
        name:"smth6",
        damage:10,
        coolDown:1000,
        canShoot:true,
        price:5,
        sellPrice:3
    },
    "smth7":{
        name:"smth7",
        damage:10,
        coolDown:1000,
        canShoot:true,
        price:5,
        sellPrice:3
    }
}
Array.prototype.last=function(){
    return this[this.length-1];
}
var ID = function () {
    return '_' + Math.random().toString(36).substr(2, 9);
  };

// server launch  
app.use(express.static(__dirname + '/public'));
app.get("/", function (req,res) {
    res.sendFile(__dirname +"public/index.html")
});
io.sockets.setMaxListeners(20);
server.listen(3000, function () {
    console.log(`Example app listening on ${server.address().port}`);
});





var engine = Matter.Engine.create();

createBase({x:200,y:300},130,130,"blue")
createBase({x:1200,y:300},130,130,"red")
createWall({x:400,y:610},1000,32);
var ground1 = Matter.Bodies.rectangle(0, 0, 10000, 1, { isStatic: true });
var ground2 = Matter.Bodies.rectangle(0, 0, 1, 10000, { isStatic: true });

var playerRadius=44.35;
var movementSpeed=10;



Matter.World.add(engine.world, [ground1,ground2]);
engine.world.gravity.y = 0;
var t=undefined;
Matter.Events.on(engine,"collisionStart",function(event){
    // console.log(event.pairs[0].bodyA.gameObjectType)
    // console.log(event.pairs[0].bodyB.gameObjectType)
    // console.log("###############")
        if(event.pairs[0].bodyB.gameObjectType=="bullet") {
                if(event.pairs[0].bodyA.health){ 
                 if(event.pairs[0].bodyA.team!=event.pairs[0].bodyB.team && event.pairs[0].bodyA.gameObjectType=="player") event.pairs[0].bodyA.changeHealthOn(event.pairs[0].bodyB.damage)
                 else if(event.pairs[0].bodyA.gameObjectType=="wall") event.pairs[0].bodyA.changeHealthOn(event.pairs[0].bodyB.damage);
                }
                Matter.Composite.remove(engine.world,event.pairs[0].bodyB)
        }
        else if(event.pairs[0].bodyA.gameObjectType=="bullet"){
                if(event.pairs[0].bodyB.health ){
                    if(event.pairs[0].bodyA.team!=event.pairs[0].bodyB.team && event.pairs[0].bodyA.gameObjectType=="player") event.pairs[0].bodyB.changeHealthOn(event.pairs[0].bodyA.damage);
                    else if(event.pairs[0].bodyB.gameObjectType=="wall") event.pairs[0].bodyB.changeHealthOn(event.pairs[0].bodyA.damage);
                }
                Matter.Composite.remove(engine.world,event.pairs[0].bodyA)
        }


});
io.on('connection', function (socket) {
    let player=createPlayer(socket);
    socket.on("connected",function(){
        let bases=createArrayOfObjects(gameObjects.bases,"base");
        socket.emit("spawnBase",bases);

        let playerData={x:player.body.position.x,y:player.body.position.y,id:player.id,team:player.body.team,}
        socket.emit("addPlayer",{...playerData,...{inventorySlots:player.body.inventorySlots,slots:Object.keys(player.body.inventorySlots).length}})
        socket.emit("currentPlayers",allPLayersPositions(socket.id))
        socket.broadcast.emit("addOtherPlayer",playerData);
        socket.emit("sendShopItems",shopItems);

        let walls=createArrayOfObjects(gameObjects.walls,"wall");
        socket.emit("spawnWall",walls);
        
    });

    
    
    // launch game cycle
    if(t!=undefined) clearInterval(t)
    t=setInterval(function(){
        Matter.Engine.update(engine, engine.timing.delta);
    },1000/60)

    socket.on("updatePLayer",function(data){

        Matter.Body.setVelocity(socket.player.body,{x:0,y:0})

        socket.player.keys.left=data.left;
        socket.player.keys.right=data.right;
        socket.player.keys.up=data.up;
        socket.player.keys.down=data.down;

        let body=socket.player.body;
        if (data.right) Matter.Body.setVelocity( body,{x:movementSpeed,y:body.velocity.y});
        if (data.left) Matter.Body.setVelocity(body,{x:-movementSpeed,y:body.velocity.y});
        if (data.up) Matter.Body.setVelocity(body,{x:body.velocity.x,y:-movementSpeed});
        if (data.down) Matter.Body.setVelocity(body,{x:body.velocity.x,y:movementSpeed});
         io.emit("sendPlayerData",{position:body.position,id:socket.id,rotation:data.rotation});
    });
    socket.on("numberPressed",function(data){
        if(socket.player.body.inventorySlots[data]!=undefined){
        if(socket.player.body.weapon==undefined){
            socket.player.body.weapon=socket.player.body.inventorySlots[data]
        }
        else if( socket.player.body.weapon!=socket.player.body.inventorySlots[data]  ) {
            clearTimeout(socket.player.body.shootTimeout);
            socket.player.body.weapon.canShoot=true;
            socket.player.body.weapon=socket.player.body.inventorySlots[data]
        }

    }
    });
    socket.on("buyItem",function(data){
        if(socket.player.body.money>=shopItems[data].price && nearBase(socket)){
            if(Object.values(player.body.inventorySlots).filter(slot=> slot==undefined).length!=0 && Object.values(player.body.inventorySlots).indexOf(shopItems[data])==-1){
                for(let d of Object.keys(player.body.inventorySlots)){
                    if(player.body.inventorySlots[d]==undefined){
                        socket.player.body.money-=shopItems[data].price;
                        player.body.inventorySlots[d]=shopItems[data];
                        socket.emit("bought",{item:player.body.inventorySlots[d],slot:d});
                        break;

                    }
                };
            }
        }
    });
    socket.on("sellItem",function(data){
            if(nearBase(socket)){
                console.log(player.body.inventorySlots[data])
                if(player.body.inventorySlots[data]!=undefined){
                    socket.player.body.money+=shopItems[player.body.inventorySlots[data].name].sellPrice;
                    player.body.inventorySlots[data]=undefined;
                    clearTimeout(socket.player.body.shootTimeout);
                    socket.player.body.weapon=undefined;
                    socket.emit("sold",data)
            }
        }
    });
   
    socket.on("spawnBullet",function(data){
        
        
        if(socket.player.body.weapon!=undefined){
        if(socket.player.body.weapon.canShoot==true) {
            
            createBullet(socket,data);
            socket.player.body.weapon.canShoot=false;
            socket.player.body.shootTimeout= setTimeout(
                ()=>{socket.player.body.weapon.canShoot=true},
                socket.player.body.weapon.coolDown)
        }
    }
   
    });
    socket.on("spawnWall",function(data){
        createWall(data,100,100)
    });

    socket.on('disconnect', function () {
        Matter.Composite.remove(engine.world, socket.player.body)
        delete gameObjects.players[socket.id];
        // delete socket.player;
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
function nearBase(socket){
    let playerpos=socket.player.body.position;
    let shapes=calculateVertices(gameObjects.bases[socket.player.body.team].body.position.x,
                                 gameObjects.bases[socket.player.body.team].body.position.y,
                                 gameObjects.bases[socket.player.body.team].body.interactiveRadius,
                                 gameObjects.bases[socket.player.body.team].body.interactiveRadius);
    let nearBase=playerpos.x>=shapes[0].x && playerpos.x<=shapes[1].x && playerpos.y>=shapes[0].y && playerpos.y<=shapes[2].y;
    return nearBase
  }
function createPlayer(socket){
    let base=getRandomBase();
    let player = {body:Matter.Bodies.circle(gameObjects.bases[base].body.position.x+200, 200, playerRadius),id:socket.id,keys:{
        left:false,
        right:false,
        up:false,
        down:false,
    }};
    player.body.inventorySlots={
        1:shopItems["smth1"],
        2:shopItems["smth2"],
        3:undefined
    }
    player.body.weapon=player.body.inventorySlots[1];
    player.body.shootTimeout=undefined;
    player.body.money=0;
    player.body.team=base;

    player.body.moneyInterval=setInterval(function(){
        player.body.money+=1;
        socket.emit("addMoney",player.body.money)
    },1000);

    player.body.friction=1;
    player.body.inertia=Infinity
    gameObjects.players[player.id]=player;
    socket.player=player;
    Matter.World.add(engine.world, player.body);

    player.body.health=100;

    player.body.changeHealthOn=function(h){
        //crutch. Because collisionStart triggers two times
        // this.prevHealth-=h/2;
        // if(this.prevHealth==this.health-h) {
            this.health-=h;
            if(this.health<=0) {
                io.emit("removePlayer",socket.id);
                Matter.Composite.remove(engine.world,player.body);
                delete gameObjects.players[player.id];
            }
            else socket.emit("changeHealth",this.health)
        // }


    };
    player.body.gameObjectType="player";
    return player
}
function createWall(position,w,h){
    let wall = {
        body:Matter.Bodies.rectangle(position.x,position.y, w,h,{
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0,
                restitution: 1,
                time:0,
                isStatic:true,
                w:w,
                h:h
              }),
        id:ID()
    }
    wall.body.health=130;
    wall.body.changeHealthOn=function(h){
        // this.prevHealth-=h/2;
        // if(this.prevHealth==this.health-h) {
            this.health-=h;
            if(this.health<=0) {
                io.emit("destroyWall",wall.id);
                Matter.Composite.remove(engine.world,wall.body);
                delete gameObjects.walls[wall.id];
            }
        };
    // }
    wall.body.gameObjectType="wall";
    Matter.World.add(engine.world, wall.body);
    gameObjects.walls[wall.id]=wall;
    io.emit( "spawnWall",{x:wall.body.position.x,y:wall.body.position.y,w:w,h:h,id:wall.id} );

}
function createBase(position,w,h,team){
    let base = {
        body:Matter.Bodies.rectangle(position.x,position.y, w,h,{
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
              }),
        id:ID()
    }
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
    // console.log(calculateVertices(200,300,230,230))
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
    let bullet = {
        body:Matter.Bodies.circle(shootPoint.x,shootPoint.y, 10,{
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0,
                restitution: 1,
                time:0
              }),   
        id:ID()
    }
    bullet.body.team=playerBody.team;
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
            id:objects[id].id
        })
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
