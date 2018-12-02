var config = {
    type: Phaser.AUTO,
    width: 1920,
    height: 943,
    physics: {
        default: 'matter',
        matter: {
            gravity: { y:0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var socket=io();


var game = new Phaser.Game(config);
function preload ()
{

        this.load.image('circle', 'assets/circle.png');
        this.load.image('ground', 'assets/platform100x100.png');
        this.load.image('bullet', 'assets/bullet.png');
        this.load.image('star', 'assets/star.png');
        this.load.tilemapTiledJSON('map', 'assets/map.json');
        this.load.image('reticle', 'assets/bomb.png');
        this.load.image('tile', 'assets/background.png');
        

}
Array.prototype.last=function(){
  return this[this.length-1];
}
var shopItems;
var gameObjects={players:{},bullets:{},walls:{}}
var connected=true;
var reloadTimer={};
var platforms,reticle,map,bullet,movementSpeed, player,point;
function create(){
    this.socket=socket;
    var self=this;
    movementSpeed=10;
    cursors = this.input.keyboard.addKeys({
      'up': Phaser.Input.Keyboard.KeyCodes.W,
      'down': Phaser.Input.Keyboard.KeyCodes.S,
      'left': Phaser.Input.Keyboard.KeyCodes.A,
      'right': Phaser.Input.Keyboard.KeyCodes.D,
      'activate': Phaser.Input.Keyboard.KeyCodes.F
    });
    map = this.make.tilemap({ key: 'map' });
        var tiles = map.addTilesetImage('background', 'tile');
        map.createStaticLayer(0, tiles, 0, 0);
        this.matter.world.setBounds(0,0,map.widthInPixels, map.heightInPixels)

        this.matter.world.on('collisionstart', function (event) {
          try {
            if(event.pairs[0].bodyA.gameObject.gameObjectType=="bullet") event.pairs[0].bodyA.gameObject.destroy()
          } catch (err) {}
          try {
            if(event.pairs[0].bodyB.gameObject.gameObjectType=="bullet") event.pairs[0].bodyB.gameObject.destroy()
          } catch (err) {}
        });
    socket.emit("connected");
    socket.on("sendShopItems",function(data){
      shopItems=data;
     
        let pages=[Object.values(data).slice(0,6)]
        for(let i=1;i<Math.ceil(Object.keys(data).length/6);i++){
          pages.push(Object.values(data).slice(pages.last().length ,pages.last().length+ 6))
        }  
      $("#page").attr("page","0")
      Object.values(pages[0]).forEach(function(d){
       createShopItem(d);
       $(".items").attr("page","0")
      });

      if(pages.length>1){
        $(".next").on("click",function(){
          if(parseInt($("#page").attr("page"))!=pages.length-1){

            $(".items").html(" ");
              Object.values(pages[ parseInt($("#page").attr("page"))+1 ]).forEach(function(d){
               createShopItem(d);
              });
              $("#page").attr("page",String(parseInt($("#page").attr("page"))+1))    
          }
        });
        $(".prev").on("click",function(){
          if(parseInt($("#page").attr("page"))!=0){
            $(".items").html(" ");
              Object.values(pages[ parseInt($("#page").attr("page"))-1 ]).forEach(function(d){
               createShopItem(d)
              });
            $("#page").attr("page",String(parseInt($("#page").attr("page"))-1))
          }
        });  
      }

      $(".buy").on("click",function(){
        let item=$(this).attr("item")
        if(self.player.money>=shopItems[item].price) socket.emit("buyItem",item)
       });
    });
    socket.on("addMoney",function(data){
      $(".money").html(data);
      self.player.money=data
    });
    this.input.keyboard.on('keyup', function (event) {
      if(event.key=="1") socket.emit("numberPressed",1);
      if(event.key=="2") socket.emit("numberPressed",2);
      if(event.key=="3") socket.emit("numberPressed",3);
      if(event.key=="r") socket.emit("reloadWeapon")
      if(event.key=="e") {
        $(".shop").toggleClass("hide");
      }
      if(event.key=="i"){
        $(".scoretable").toggleClass("hide");
      }
    });
    socket.on("numberPressed",function(data){
      self.player.curActiveSlot=data.index;
      $(".currAmmo").html(data.data.currClip);
      $(".remainAmmo").html(data.data.ammo);
      toggleActiveSlot(data.index);
      stopTimerAnimation()
    });
    socket.on("bought",function(data){

      $(`.slot[slot=${data.slot}]`).html(createInvSlotString(data.slot,
        data.item.ammoPrice,
        data.item.name,
        data.item.damage,
        data.item.coolDown,
        data.item.sellPrice
        
        ));


      $(".weapon p").eq(data.slot-1).html(data.item.name)
      updateShopButtons(socket);
    });
    socket.on("sold",function(data){
      
      $(`.slot[slot=${data[0]}]`).html(
        `
        <div class="num">${data[0]}</div>
        `
      );
      $(".weapon p").eq(data[0]-1).html("");
      
      if(data[1]){ 
        stopTimerAnimation();  
        $(".weapon").removeClass("active");
      }
    });
    socket.on("ammoRefilled",function(data){
      if (self.player.curActiveSlot==data.slot) $(".remainAmmo").html(data.ammo);
    });
    socket.on("addPlayer",function(data){
      player= createPlayer(self,data);
      self.player=player;
      player.curActiveSlot=1;
      for(let i=1;i<=data.slots;i++){

        if(data.inventorySlots[i]!=undefined){ 

          $(".inventory").append(`<div class="slot" slot=${i}>
            ${createInvSlotString(i,data.inventorySlots[i].ammoPrice,data.inventorySlots[i].name,data.inventorySlots[i].damage,data.inventorySlots[i].coolDown,data.inventorySlots[i].sellPrice)}
            </div>`
            )

          //add weapon slot to hotbar      
          $(".weapons").append(`
          <div class="weapon">
          <div class="num">${i}</div>
          <p>${data.inventorySlots[i].name}</p> 
          </div>`)  
        }
        else {
          $(".inventory").
          append(
                `<div class="slot" slot=${i}>
                <div class="num">${i}</div>
                </div>`)
          //add empty weapon slot to hotbar   
          $(".weapons").append(`
              <div class="weapon">
              <div class="num">${i}</div>
              <p> </p> 
              </div>`)  
        }
      }
      updateShopButtons(socket)

      $(".weapon").eq(0).addClass("active")

      reticle = self.add.sprite(player.x,player.y, 'reticle');
        reticle.setOrigin(0.5, 0.5);
        self.input.mouse.disableContextMenu();
      var camera = self.cameras.main;
        camera.startFollow(player);
        camera.zoom=1;
        camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      $(".health").html("100")
    });
    socket.on("currentPlayers",function(data){
      if(Object.keys(data).length!==0){

      Object.keys(data).forEach(function(id){
        createPlayer(self,data[id])
      });

    }
    });
    socket.on("addOtherPlayer",function(data){
      createPlayer(self,data)
    });
    socket.on("sendPlayerData",function(data){
      let player= gameObjects.players[data.id];
      if(player){
      player.x=data.position.x;
      player.y=data.position.y;
       player.point.x=player.x+Math.cos(data.rotation)*( (player.displayWidth/2+30))
       player.point.y=player.y+Math.sin(data.rotation)*( (player.displayHeight/2+30))
      }
        });

    socket.on("changeHealth",function(data){
        $(".health").html(data)
    });
    socket.on("spawnWall",function(data){
      if(Array.isArray(data))
      {
        data.forEach(function(d){
          spawnWall(self,d.x,d.y,d.w,d.h,d.id);
        });
      }
      else spawnWall(self,data.x,data.y,data.w,data.h,data.id);
    });
    socket.on("spawnBase",function(data){
      if(Array.isArray(data))
      {
        data.forEach(function(d){
          spawnBase(self,d.x,d.y,d.w,d.h);
        });
      }
      else spawnBase(self,data.x,data.y,data.w,data.h,radius);
    });
    
    this.input.on("pointerdown",function(pointer){
        if(pointer.rightButtonDown()) socket.emit("spawnWall",{x:reticle.x,y:reticle.y});
    });
    socket.on("bulletSpawned",function(data){
        spawnBullet(self,data);
        if(socket.id==data.owner)  $(".currAmmo").html(data.clip);
    });
    socket.on("reloaded",function(data){
      $(".currAmmo").html(data.currClip);
      $(".remainAmmo").html(data.ammo);
    });
    socket.on("reload",function(data){
      timer(self,data)
    });
    socket.on("connect_error", function (data) {
      console.log('connection_error');
      connected=false;
    });
    socket.on("dead",function(){
      player=undefined
    });
  socket.on("removePlayer",function(data){
    if( typeof(data)=="object" ){
    
    gameObjects.players[data.killer].addScore(100);
    gameObjects.players[data.dead].addScore(-100);
    $(`.row[id=${data.killer}] .score`).attr("score",data.killerScore)
    $(`.row[id=${data.killer}] .kills`).attr("kills",data.killerKills)
    $(`.row[id=${data.dead}] .score`).attr("score",data.deadScore)
    $(`.row[id=${data.dead}] .killed`).attr("killed",data.deadKilled)
    removePlayerObject(data.dead)
    }
    else if(typeof(data)=="string"){
     $(`.row[id=${data}] `).remove()
     removePlayerObject(data)
    }
    });
  socket.on("destroyWall",function(data){
    gameObjects.walls[data].destroy();
    delete gameObjects.walls[data];
  });
}

function update(){
if(this.input.activePointer.buttons==1 && this.input.activePointer.isDown) socket.emit("spawnBullet",{x:reticle.x,y:reticle.y});
  if(player){
    player.rotation = Phaser.Math.Angle.Between(player.x, player.y, reticle.x, reticle.y);
    socket.emit("updatePLayer",{
        left:cursors.left.isDown,
        right:cursors.right.isDown,
        up:cursors.up.isDown,
        down:cursors.down.isDown,
        rotation:player.rotation,
    });
  constrainReticle(reticle,player,this.cameras.main)
}
}


function constrainReticle(reticle,player,camera){
    if(player.x> map.widthInPixels - camera.width/2)  reticle.x=game.input.mousePointer.x+map.widthInPixels - camera.width;
    else if(player.x>=camera.width/2) reticle.x=game.input.mousePointer.x+(player.x-camera.width/2);
    else reticle.x=game.input.mousePointer.x
    if(player.y>map.heightInPixels - camera.height/2)  reticle.y=game.input.mousePointer.y+map.heightInPixels - camera.height;
    else if(player.y>=camera.height/2) reticle.y=game.input.mousePointer.y+(player.y-camera.height/2);
    else reticle.y=game.input.mousePointer.y
}


function spawnBullet(self,data){
    bullet=self.matter.add.sprite(data.position.x,data.position.y,"bullet",null,{friction:0,restitution:1,frictionStatic:0,frictionAir:0});
    bullet.gameObjectType="bullet";
    bullet.setFixedRotation();
    bullet.setSensor(true);
    bullet.angle=data.angle;
    bullet.setMass(0.1)
    bullet.setVelocity(data.velocity.x,data.velocity.y)
    gameObjects.bullets[data.id]=bullet;
}

function createShopItem(d){
  $(".items").append(`
                <div class="shopItem" >
                <p>Name:${d.name}</p>
                <p>Damage:${d.damage}</p>
                <p>Shoot Rate:${d.coolDown}</p>
                <div class="buyButton buy shopButton" item=${d.name}>${d.price}$</div>
                </div>`
                )
}
function removePlayerObject(id){
  gameObjects.players[id].point.destroy();
  gameObjects.players[id].destroy();
  delete gameObjects.players[id]
}
function createPlayer(self,data){
  let  player = self.matter.add.image(data.x,data.y, 'circle',null,{inertia:Infinity});
    player.setCircle();
    player.setScale(0.1,0.1)
    player.setOrigin(0.5,0.5);
    player.money=0;
    player.id=data.id;
    player.score=0;
    player.inventorySlots=data.inventorySlots;
  player.point=self.add.image(data.x,data.y, 'star');
  player.addScore=function(i){
    if(this.score+i<0) this.score=0
    else this.score+=i
  }
  if(data.team=="red") {
    player.setTint(0xff0000)
    addToScoreTable(1,data.id)
  }
  else addToScoreTable(0,data.id)

  gameObjects.players[data.id]=player;

  return player;
}
function spawnWall(self,x,y,w,h,id){
  let wall = self.matter.add.image(x,y, 'ground',null);
  wall.setStatic(true);
  wall.setScale(w/100, h/100);
  wall.setFriction(0.005);
  gameObjects.walls[id]=wall;
}
function spawnBase(self,x,y,w,h){

  let radius = self.add.image(x,y, 'tile',null);
  radius.displayWidth=w+200;
  radius.displayHeight=h+200;
  let base = self.matter.add.sprite(x,y, 'ground');
  base.setStatic(true);
  base.setScale(w/100, h/100);
  base.setFriction(0.005);
}
function updateShopButtons(socket){
  $(".sell").off("click");
  $(".buyAmmo").off("click");
  $(".sell").on("click",function(){
    let item=$(this).parent().attr("slot")
    socket.emit("sellItem",item)
   });
   $(".buyAmmo").on("click",function(){
    let item=$(this).parent().attr("slot")
    socket.emit("buyAmmo",item)
   });
}
function createInvSlotString(slot,ammoPrice,name,damage,coolDown,sellPrice){
 return `
                <div class="num">${slot}</div>
                <div class="buyAmmo  shopButton">${ammoPrice}</div>
                <p>Name:${name}</p>
                <p>Damage:${damage}</p>
                <p>Shoot Rate:${coolDown}</p>
                <div class="buyButton sell shopButton" item="${slot}">${sellPrice}$</div>
                `
}
function timer(self,time){
  let updateTime=10
  let no=0;
  let graphics = self.add.graphics();
  reloadTimer.stopAnimation=false;
  reloadTimer.graphics=graphics;
  let curDeg=270;
  let alphaDeg=360/(time/updateTime);
  let arc;
  if(reloadTimer.timer) clearInterval(reloadTimer.timer);
  reloadTimer.timer=setInterval(function(){
      if(arc) arc.clear();
      graphics.lineStyle(4, 0xff00ff, 1);
      graphics.beginPath();
      curDeg+=alphaDeg;
      arc=graphics.arc(self.player.x, self.player.y-100, 50, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(curDeg), false);
      graphics.strokePath();
    if(reloadTimer.stopAnimation){
      clearTimeout(reloadTimer.timer);
      graphics.destroy();
      reloadTimer.stopAnimation=false;
    }  
    else if(no>=time/updateTime){
        clearTimeout(reloadTimer.timer);
        graphics.destroy();
       
      }
    no++
    
   },updateTime); 

}
function stopTimerAnimation(){
  reloadTimer.stopAnimation=true;
}
function toggleActiveSlot(i){
  $(".weapon").removeClass("active")
  $(".weapon").eq(i-1).addClass("active")
}
function addToScoreTable(team,id){
  $(".team").eq(team).append(`
  <div class="row" id="${id}">
  <div class="name" > ${id}</div>
  <div class="kills" kills="0"> </div>
  <div class="killed" killed="0"> </div>
  <div class="score" score="0" ></div>
  </div>`)

}