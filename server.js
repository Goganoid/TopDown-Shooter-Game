var express= require("express");
var app = express();
var server= require("http").Server(app);
var io = require("socket.io").listen(server);
var Matter = require('matter-js/build/matter.js');
var gameObjects={players:{},bullets:{},walls:{},bases:{}};
var playersInTeams={
    "red":0,
    "blue":0
}
var Weapon= function(name,damage,coolDown,ammo,clipSize,price,reloadTime,ammoPrice){
    this.name=name;
    this.damage=damage;
    this.coolDown=coolDown;
    this.ammo=ammo;
    this.clipSize=clipSize;
    this.price=price;
    this.ammoPrice=ammoPrice;
    this.sellPrice=Math.ceil(price/2);
    this.canShoot=false;
    this.currClip=0;
    this.reloadTime=reloadTime;
    this.reloading=false;
    this.maxAmmo=ammo;
    return this
};

var shopItems={
    "smth1": new Weapon("smth1",5,50,200,50,15,1000,10),
    "smth2": new Weapon("smth2",10,500,50,10,10,2000,5),
    "smth3": new Weapon("smth3",10,1000,30,5,5,3000,3),
    "smth4": new Weapon("smth4",10,1000,30,5,5,4000,6),
}
Array.prototype.last=function(){
    return this[this.length-1];
}
var ID = function () {
    return '_' + Math.random().toString(36).substr(2, 9);
  };

// server launch  
app.use(express.static(__dirname + '/public'));
app.get("/", function (res) {
    res.sendFile(__dirname +"public/index.html")
});
io.sockets.setMaxListeners(20);
server.listen(3000, function () {
    console.log(`Example app listening on ${server.address().port}`);
});





var engine = Matter.Engine.create();
engine.world.gravity.y = 0;
createBase({x:200,y:300},130,130,"blue")
createBase({x:1200,y:300},130,130,"red")
createWall({x:400,y:610},1000,32);


var playerRadius=44.35;
var movementSpeed=10;


//create world borders
Matter.World.add(engine.world, [
    Matter.Bodies.rectangle(0, 0, 48000, 1, { isStatic: true }),
    Matter.Bodies.rectangle(0, 4800, 48000, 1, { isStatic: true }),
    Matter.Bodies.rectangle(0, 0, 1, 48000, { isStatic: true }),
    Matter.Bodies.rectangle(4800, 0, 1, 48000, { isStatic: true }),
]);


    // launch game cycle
    setInterval(function(){
        Matter.Engine.update(engine, engine.timing.delta);
    },1000/60)
Matter.Events.on(engine,"collisionStart",function(event){
    
        if(event.pairs[0].bodyB.gameObjectType=="bullet") {
                if(event.pairs[0].bodyA.health){ 
                 if(event.pairs[0].bodyA.team!=event.pairs[0].bodyB.team && event.pairs[0].bodyA.gameObjectType=="player") event.pairs[0].bodyA.changeHealthOn(event.pairs[0].bodyB.damage,event.pairs[0].bodyB.playerId)
                 else if(event.pairs[0].bodyA.gameObjectType=="wall") event.pairs[0].bodyA.changeHealthOn(event.pairs[0].bodyB.damage);
                }
                Matter.Composite.remove(engine.world,event.pairs[0].bodyB)
        }
        else if(event.pairs[0].bodyA.gameObjectType=="bullet"){
                if(event.pairs[0].bodyB.health ){
                    if(event.pairs[0].bodyA.team!=event.pairs[0].bodyB.team && event.pairs[0].bodyA.gameObjectType=="player") event.pairs[0].bodyB.changeHealthOn(event.pairs[0].bodyA.damage,event.pairs[0].bodyA.playerId);
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
            socket.emit("numberPressed",{data:socket.player.body.inventorySlots[data],index:data})
        }
        else if( socket.player.body.weapon!=socket.player.body.inventorySlots[data]) {
            clearTimeout(socket.player.body.shootTimeout);
            socket.player.body.weapon.canShoot=true;
            socket.player.body.weapon.reloading=false;
            socket.player.body.weapon=socket.player.body.inventorySlots[data]
            socket.emit("numberPressed",{data:socket.player.body.inventorySlots[data],index:data})
        }

    }
    });
    socket.on("reloadWeapon",function(){
        reload(socket)
    });
    socket.on("buyItem",function(data){
        if(socket.player.body.money>=shopItems[data].price && nearBase(socket)){
            if(Object.values(player.body.inventorySlots).filter(slot=> slot==undefined).length!=0 && Object.values(player.body.inventorySlots).indexOf(shopItems[data])==-1){
                for(let d of Object.keys(player.body.inventorySlots)){
                    if(player.body.inventorySlots[d]==undefined){
                        socket.player.body.money-=shopItems[data].price;
                        player.body.inventorySlots[d]=Object.assign({},shopItems[data]);
                        socket.emit("bought",{item:player.body.inventorySlots[d],slot:d});
                        break;
                    }
                }
            }
        }
    });
    socket.on("buyAmmo",function(data){
        if(socket.player.body.money>=player.body.inventorySlots[data].ammoPrice && nearBase(socket) && player.body.inventorySlots[data].ammo!= player.body.inventorySlots[data].maxAmmo ){
            player.body.inventorySlots[data].ammo= player.body.inventorySlots[data].maxAmmo;
            socket.player.body.money-=player.body.inventorySlots[data].ammoPrice;
            socket.emit("ammoRefilled", {ammo:player.body.inventorySlots[data].ammo,slot:data})
        }
    });
    socket.on("sellItem",function(data){
            if(nearBase(socket)){
                if(player.body.inventorySlots[data]!=undefined){
                    socket.player.body.money+=shopItems[player.body.inventorySlots[data].name].sellPrice;
                    if(socket.player.body.weapon!=undefined){
                    if(socket.player.body.weapon.name == player.body.inventorySlots[data].name){
                        socket.emit("sold",[data,true])
                        clearTimeout(socket.player.body.shootTimeout);
                        socket.player.body.weapon=undefined;
                    }
                    else{
                        socket.emit("sold",[data,false])
                    }
                }
                else{
                    socket.emit("sold",[data,false])
                }
                    
                    player.body.inventorySlots[data]=undefined;
                    
            }
        }
    });
   
    socket.on("spawnBullet",function(data){
        if(socket.player.body.weapon!=undefined){
           
        if(socket.player.body.weapon.currClip!=0 && socket.player.body.weapon.reloading==false){ 
            if(socket.player.body.weapon.canShoot==true) {
                socket.player.body.weapon.currClip-=1;
                createBullet(socket,data,socket.player.body.weapon.currClip,socket.player.body.weapon.damage);
                socket.player.body.weapon.canShoot=false;
                socket.player.body.shootTimeout= setTimeout(
                    ()=>{
                        socket.player.body.weapon.canShoot=true
                    },
                    socket.player.body.weapon.coolDown)
            }
        }
      
        else if(socket.player.body.weapon.reloading==false) reload(socket)
    }
   
    });
    socket.on("spawnWall",function(data){
        createWall(data,100,100,130)
    });

    socket.on('disconnect', function () {
        playersInTeams[ socket.player.body.team]-=1;
        socket.player.body.remove();
        
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
    let base=getBase();
    playersInTeams[base]+=1;
    let player = {body:Matter.Bodies.circle(gameObjects.bases[base].body.position.x+200, 200, playerRadius),id:socket.id,keys:{
        left:false,
        right:false,
        up:false,
        down:false,
    }};
    player.body.inventorySlots={
        1: Object.assign({},shopItems["smth1"]),
        2: Object.assign({},shopItems["smth2"]),
        3:undefined
    }
    player.body.id=socket.id;
    player.body.weapon=player.body.inventorySlots[1];
    player.body.shootTimeout=undefined;
    player.body.money=0;
    player.body.team=base;
    player.body.score=0;
    player.body.kills=0;
    player.body.killed=0;
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
    player.body.remove=function(killerData){
        
        if(killerData) io.emit("removePlayer",killerData)
        else io.emit("removePlayer",socket.id)
        
        Matter.Composite.remove(engine.world, player.body)
        delete gameObjects.players[socket.id];
    };
    player.body.changeHealthOn=function(h,id){
            this.health-=h;
            
            if(this.health<=0) {
                gameObjects.players[id].body.money+=100;
                gameObjects.players[id].body.score+=100;
                gameObjects.players[id].body.kills+=1;
                socket.player.body.score-= socket.player.body.score>=100 ? 100 : socket.player.body.score  ;
                socket.player.body.killed+=1;
                socket.emit("dead");
                player.body.remove({
                        dead:player.id,
                        killer:id,
                        killerScore: gameObjects.players[id].body.score,
                        deadScore:socket.player.body.score,
                        killerKills: gameObjects.players[id].body.kills,
                        deadKilled:socket.player.body.killed});
            }
            else socket.emit("changeHealth",this.health)
    };
    player.body.gameObjectType="player";
    return player
}
function createWall(position,w,h,health){
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
    wall.body.health=health;
    wall.body.changeHealthOn=function(h){
            this.health-=h;
            if(this.health<=0) {
                io.emit("destroyWall",wall.id);
                Matter.Composite.remove(engine.world,wall.body);
                delete gameObjects.walls[wall.id];
            }
        };
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
    io.emit( "spawnBase",{x:base.body.position.x,y:base.body.position.y,w:w,h:h} );
    return base

}
function createBullet(socket,mousePosition,clip,damage){
    let playerBody=gameObjects.players[socket.id].body;
    let angle=Matter.Vector.angle(playerBody.position, mousePosition);
    let shootPoint={
        x:playerBody.position.x+ Math.cos(angle) *(playerRadius),
        y:playerBody.position.y+ Math.sin(angle) *(playerRadius)
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
    bullet.body.playerId=socket.player.id;
    bullet.body.gameObjectType="bullet";
    bullet.body.damage=damage;
    bullet.body.isSensor=true;
    Matter.World.add(engine.world, bullet.body);

    Matter.Body.setMass(bullet.body,0.1)
    Matter.Body.setVelocity(bullet.body,{x: Math.cos(angle)*20,y:Math.sin(angle)*20})
    io.emit( "bulletSpawned",{ 
        position:bullet.body.position,
        velocity:bullet.body.velocity,angle:angle * 180 / Math.PI,
        id:bullet.id,
        clip:clip,
        owner:socket.id } )
}
function reload(socket){
    if(socket.player.body.weapon!=undefined){
        if(socket.player.body.weapon.currClip!=socket.player.body.weapon.clipSize && !socket.player.body.weapon.reloading){
            clearTimeout(socket.player.body.shootTimeout);
            socket.player.body.weapon.canShoot=false;
            socket.player.body.weapon.reloading=true;

            
            socket.player.body.weapon.ammo+=socket.player.body.weapon.currClip;
            socket.player.body.weapon.currClip=0;

            if(socket.player.body.weapon.ammo!=0 ){
            
            socket.player.body.shootTimeout=setTimeout(
                ()=>{
                    socket.player.body.weapon.canShoot=true;
                    socket.player.body.weapon.reloading=false;
                    if(socket.player.body.weapon.ammo<socket.player.body.weapon.clipSize){
                        socket.player.body.weapon.currClip=socket.player.body.weapon.ammo;
                        socket.player.body.weapon.ammo=0;
                    }
                    else{
                    socket.player.body.weapon.ammo-=socket.player.body.weapon.clipSize;
                    socket.player.body.weapon.currClip=socket.player.body.weapon.clipSize;
                    }
                    socket.emit("reloaded",socket.player.body.weapon)
                },
                socket.player.body.weapon.reloadTime
            )

            socket.emit("reload",socket.player.body.weapon.reloadTime)
            }
            else{
                socket.player.body.weapon.canShoot=true;
                socket.player.body.weapon.reloading=false;
            }
        }
    }
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
function getBase(){
    if(playersInTeams.red==playersInTeams.blue) return getRandomInt(0,2)==0 ? "blue" : "red"
    else return playersInTeams.red>playersInTeams.blue ? "blue" : "red"
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }