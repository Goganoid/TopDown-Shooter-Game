
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
// var actions={};
// var Bullet = new Phaser.Class({
//     Extends: Phaser.GameObjects.Image,
//     initialize:
//     //  Bullet Constructor
//     function Bullet (scene)
//         {
//             Phaser.GameObjects.Image.call(this, scene, 0, 0, 'bullet');
//             this.setSize(12, 12, true);
//         },
//     update: function (time, delta)
//     {
//         socket.emit("updateBullet");
//     }

// });
// class Bullet extends Phaser.GameObjects.Sprite {

//     constructor (scene, x, y,id)
//     {
//         super(scene, x, y);
//         this.id=id;
//         this.setTexture('bullet');
//         this.setPosition(x, y);
//         socket.on()
//     }

//     preUpdate (time, delta)
//     {
//         super.preUpdate(time, delta);

//         socket.emit("updateBullet",this.id);

//     }

// }

var game = new Phaser.Game(config);
function preload ()
{

        this.load.image('sky', 'assets/sky.png');
        this.load.image('circle', 'assets/circle.png');
        this.load.image('ground', 'assets/platform2.png');
        this.load.image('white', 'assets/white.png');
        this.load.image('white-h', 'assets/white-h.png');
        this.load.image('bullet', 'assets/bullet.png');
        this.load.image('star', 'assets/star.png');
        this.load.tilemapTiledJSON('map', 'assets/map.json');
        this.load.image('reticle', 'assets/bomb.png');
        this.load.image('tile', 'assets/background.png');
        this.load.spritesheet('dude',
            'assets/dude.png',
            { frameWidth: 32, frameHeight: 48 }
        );

}

var platforms,score,scoreText,gameOver,lives,reticle,prevPos,map,boxes, positionOnCollide, playerBullets,bullet,movementSpeed, player,point;
function create(){
    var self=this;
    movementSpeed=10;
    map = this.make.tilemap({ key: 'map' });
        var tiles = map.addTilesetImage('background', 'tile');
        var layer = map.createStaticLayer(0, tiles, 0, 0);
        this.matter.world.setBounds(0,0,map.widthInPixels, map.heightInPixels)
        this.matter.world.on('collisionstart', function (event) {
          console.log(event.pairs[0]);
          try {
            if(event.pairs[0].bodyA.gameObject.gameObjectType=="bullet") event.pairs[0].bodyA.gameObject.destroy()
          } catch (err) {}
          try {
            if(event.pairs[0].bodyB.gameObject.gameObjectType=="bullet") event.pairs[0].bodyB.gameObject.destroy()
          } catch (err) {}
        });

    let player= createPlayer(this);

    point= this.add.image(400,200, 'star')

    reticle = this.add.sprite(player.x,player.y, 'reticle');
        reticle.setOrigin(0.5, 0.5)
    var platform = this.matter.add.sprite(400,610, 'ground');
    platform.setStatic(true);
    platform.setScale(2, 0.5);
    console.log(platform.displayHeight,platform.displayWidth)
    platform.setFriction(0.005);

    var camera = this.cameras.main;
        camera.startFollow(player);
        camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    socket.on("sendPlayerData",function(data){
        player.x=data.x;
        player.y=data.y;
    });

    cursors = this.input.keyboard.addKeys({
              'up': Phaser.Input.Keyboard.KeyCodes.W,
              'down': Phaser.Input.Keyboard.KeyCodes.S,
            'left': Phaser.Input.Keyboard.KeyCodes.A,
            'right': Phaser.Input.Keyboard.KeyCodes.D,
            'activate': Phaser.Input.Keyboard.KeyCodes.F
    });
    this.input.on("pointerdown",function(pointer){
        socket.emit("spawnBullet",{x:reticle.x,y:reticle.y});
        console.log(point.x,point.y)

    })
    socket.on("bulletSpawned",function(data){
        spawnBullet(self,data)
    });

}

function update(){
    player.setVelocity(0,0)
    player.rotation = Phaser.Math.Angle.Between(player.x, player.y, reticle.x, reticle.y);
    point.x=player.x+Math.cos(player.rotation)*( (player.displayWidth/2+30));
    point.y=player.y+Math.sin(player.rotation)*( (player.displayHeight/2 +30));

    // point.rotation=Phaser.Math.Angle.Between(player.x, player.y, reticle.x, reticle.y);
    socket.emit("updatePLayer",{
        left:cursors.left.isDown,
        right:cursors.right.isDown,
        up:cursors.up.isDown,
        down:cursors.down.isDown
    });
        if (cursors.right.isDown) player.setVelocityX(movementSpeed);
        if (cursors.left.isDown) player.setVelocityX(-movementSpeed);
        if (cursors.up.isDown) player.setVelocityY(-movementSpeed);
        if (cursors.down.isDown) player.setVelocityY(movementSpeed);

  constrainReticle(reticle,player,this.cameras.main)

}


function constrainReticle(reticle,player,camera){
    if(player.x> map.widthInPixels - camera.width/2)  reticle.x=game.input.mousePointer.x+map.widthInPixels - camera.width;
    else if(player.x>=camera.width/2) reticle.x=game.input.mousePointer.x+(player.x-camera.width/2);
    else reticle.x=game.input.mousePointer.x
    if(player.y>map.heightInPixels - camera.height/2)  reticle.y=game.input.mousePointer.y+map.heightInPixels - camera.height;
    else if(player.y>=camera.height/2) reticle.y=game.input.mousePointer.y+(player.y-camera.height/2);
    else reticle.y=game.input.mousePointer.y
}

function changeSize(object,w,h){
  if(h!=undefined){
    object.height=h;
    object.displayHeight=h;
  }
  if(w!=undefined){
    object.width=w;
    object.displayWidth=w;
  }
}
function spawnBullet(self,data){
    let bullet=self.matter.add.image(data.position.x,data.position.y,"bullet",null,{friction:0,restitution:1,frictionStatic:0,frictionAir:0});
    bullet.angle=data.angle;
    bullet.gameObjectType="bullet";
    bullet.setFixedRotation();
    bullet.applyForce({x:data.velocity.x,y:data.velocity.y})
}


function createPlayer(self){
  player = self.matter.add.image(400,200, 'circle',null,{inertia:Infinity}).setBounce(0).setFriction(0);
    player.setFriction(0.005);
    player.setCircle();
    player.setScale(0.1,0.1)
    player.setOrigin(0.5,0.5);
  return player;
}
// function create ()
// {

//     movementSpeed=900

//     // playerBullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
//     // console.log(this.matter.world.setGravity(0,0))
//     score=0;
//     scoreText=this.add.text(16,16,'score:0',{fontSize:"32px",fill:"#000"});
//

//         // player.body.bounce.x=0;
//         // player.body.bounce.y=0;
//         player.setCollideWorldBounds(true);
//         // player.body.syncBounds=true;
//     // cursors = this.input.keyboard.createCursorKeys();

//     var platform = this.matter.add.image(50 , 550, 'ground', null, { isStatic: true });

//    cursors = this.input.keyboard.addKeys({
//         'up': Phaser.Input.Keyboard.KeyCodes.W,
//         'down': Phaser.Input.Keyboard.KeyCodes.S,
//         'left': Phaser.Input.Keyboard.KeyCodes.A,
//         'right': Phaser.Input.Keyboard.KeyCodes.D,
//         'activate': Phaser.Input.Keyboard.KeyCodes.F
//     });
//     platforms = this.matter.add.group();
//         platforms.create(400, 568, 'ground')
//         platforms.create(600, 400, 'ground');

//         platforms.create(1920, 1920, 'ground');
//     // platforms.children.iterate(function(f){
//     //     f.body.bounce.x=0;
//     //     f.body.bounce.y=0;
//     // });

//     //  boxes = this.physics.add.staticGroup();
//     //   boxes.create(100,200, 'ground').setScale(0.1,1).refreshBody();

//     // stars = this.physics.add.group({
//     //     key: 'star',
//     //     repeat: 11,
//     //     setXY: { x: 12, y: 0, stepX: 70 }
//     //     });
//     //     stars.children.iterate(function (child) {
//     //     child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
//     //     });
//     //     this.physics.add.collider(stars,platforms)
//     //     this.physics.add.overlap(player,stars,collectStar,null,this)

//     // bombs = this.physics.add.group();
//     //     this.physics.add.collider(bombs, platforms);
//     //     this.physics.add.collider(player, bombs, hitBomb, null, this);

//     reticle = this.matter.add.sprite(player.x,player.y, 'reticle');
//         // reticle.setOrigin(0.5, 0.5).setCollideWorldBounds(true)

//         // reticle.body.bounce.y=0;
//         // reticle.body.bounce.x=0;

// //     this.physics.add.collider(player,platforms)
// //     // this.physics.add.collider(reticle,platforms)
// //     this.physics.add.collider(player,boxes,function(box){
// // // console.log(boxes)
// //     if($("#ui").attr("class")!="pick"){
// //         $("#ui").removeClass();
// //         $("#ui").addClass("pick");
// //         $("#ui").append('<div id="DD">dd</div>')
// //     }
// //     positionOnCollide={x:player.x,y:player.y};
// //     });




//     // this.physics.world.setBounds(0,0,map.widthInPixels, map.heightInPixels)
    // this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

//     prevPos={x:player.x,y:player.y};
//     var camera = this.cameras.main;
//     camera.startFollow(player);
//    this.input.on("pointerdown",function(pointer){
//     // console.log(pointer.leftButtonDown())
//     console.log(this.input.activePointer)
//      bullet = playerBullets.get().setActive(true).setVisible(true);
//     if (bullet)
//     {
//         bullet.fire(player, reticle);
//         // this.physics.add.collider(enemy, bullet, enemyHitCallback);
//     }
//    },this);

// }
// function update(){
// //     console.log(checkOverlap(player,boxes.children.entries[0]))
// //     // console.log(this.input.activePointer.isDown)
// //     if(this.input.activePointer.isDown){
// //     if(bullet.born>=180){
// //     bullet = playerBullets.get().setActive(true).setVisible(true);
// //     if (bullet)
// //     {
// //         bullet.fire(player, reticle);
// //         // this.physics.add.collider(enemy, bullet, enemyHitCallback);
// //     }
// // }


// // }
// //     player.rotation = Phaser.Math.Angle.Between(player.x, player.y, reticle.x, reticle.y);
// // if(positionOnCollide!=undefined){
// //     if(player.x!=positionOnCollide.x || player.y!=positionOnCollide.y){
// //         $("#DD").remove();
// //         $("#ui").removeClass();
// //     }
// // }

// // // console.log(player.y,map.heightInPixels)
// // player.setVelocityX(0);
// // player.setVelocityY(0);
// //  if(cursors.left.isDown){
// //      player.setVelocityX(-movementSpeed);
// //     // player.anims.play("left",true);
// //  }
// //  else if(cursors.right.isDown){
// //     player.setVelocityX(movementSpeed);
// //    // player.anims.play("right",true);
// // }
// // else{
// //     player.setVelocityX(0);
// //    // player.anims.play("turn");
// // }
// // if(cursors.up.isDown){
// //     player.setVelocityY(-movementSpeed);
// //    // player.anims.play("left",true);
// // }
// // if(cursors.down.isDown){
// //     player.setVelocityY(movementSpeed);
// //    // player.anims.play("left",true);
// // }

// // constrainReticle(reticle,player,this.cameras.main);



// // prevPos={x:player.x,y:player.y};



// }
// function collectStar(player,star){
//  star.disableBody(true,true )
//  score+=10;
//  scoreText.setText("score: "+score)
//  if(stars.countActive===0){
//      stars.children.iterate(function(child){
//          child.enableBody(true,child.x,0,true,true)
//      });
//  }
// //  var x=(player.x < 400) ? Phaser.Math.Between(400, 800) : Phaser.Math.Between(0, 400);
// //  var bomb=bombs.create(x,16,"bomb");
// //     bomb.setBounce(1);
// //     bomb.setCollideWorldBounds(true);
// //     bomb.setVelocity(Phaser.Math.Between(-200,200),20);
// //     bomb.allowGravity=false;
// //     this.physics.add.collider(bomb,bombs)
// }
// function constrainReticle(reticle,player,camera){
//     if(player.x> map.widthInPixels - camera.width/2)  reticle.x=game.input.mousePointer.x+map.widthInPixels - camera.width;
//     else if(player.x>=camera.width/2) reticle.x=game.input.mousePointer.x+(player.x-camera.width/2);
//     else reticle.x=game.input.mousePointer.x
//     if(player.y>map.heightInPixels - camera.height/2)  reticle.y=game.input.mousePointer.y+map.heightInPixels - camera.height;
//     else if(player.y>=camera.height/2) reticle.y=game.input.mousePointer.y+(player.y-camera.height/2);
//     else reticle.y=game.input.mousePointer.y
// }

// function checkOverlap(a,b) {
//     // console.log(
//     //     ((a.y + a.height) < (b.y))
//     // )
//     // console.log( (a.y > (b.y + b.height)))
//     // console.log(((a.x + a.width) < b.x))
//     // console.log((a.x > (b.x + b.width)))
//     return !(
//         ((a.y + a.height) < (b.y)) ||
//         (a.y > (b.y + b.height)) ||
//         ((a.x + a.width) < b.x) ||
//         (a.x > (b.x + b.width))
//     );
// }


// function hitBomb(player,bomb){
//     score-=10;
//     scoreText.setText("score: "+score)
//     if(score==0){
//     this.physics.pause();
//     player.setTint(0xff0000);
//  //   player.anims.play("turn");
//     gameOver=true;
//     }
// }

// function createwall(group,gravity,x,y,sprite,sx,sy){
//     let wall= group.create(x,y,sprite);
//     wall.body.allowGravity=false;
//     wall.setScale(sx,sy)
//     wall.body.immovable = true;
// }


// // var Bullet = new Phaser.Class({

// //     Extends: Phaser.GameObjects.Image,

// //     initialize:

// //     // Bullet Constructor
// //     function Bullet (scene)
// //     {
// //         Phaser.GameObjects.Image.call(this, scene, 0, 0, 'bullet');
// //         this.speed = 1;
// //         this.born = 0;
// //         this.direction = 0;
// //         this.xSpeed = 0;
// //         this.ySpeed = 0;

// //         this.setSize(12, 12, true);
// //     },

// //     // Fires a bullet from the player to the reticle
// //     fire: function (shooter, target)
// //     {
// //         this.setPosition(shooter.x, shooter.y);

// //          // Initial position
// //          this.body.allowGravity=false
// //          this.direction = Math.atan( (target.x-this.x) / (target.y-this.y));

// //         // Calculate X and y velocity of bullet to moves it from shooter to target
// //         if (target.y >= this.y)
// //         {
// //             this.xSpeed = this.speed*Math.sin(this.direction);
// //             this.ySpeed = this.speed*Math.cos(this.direction);
// //         }
// //         else
// //         {
// //             this.xSpeed = -this.speed*Math.sin(this.direction);
// //             this.ySpeed = -this.speed*Math.cos(this.direction);
// //         }

// //         this.rotation = shooter.rotation; // angle bullet with shooters rotation
// //         this.born = 0; // Time since new bullet spawned
// //     },

// //     // Updates the position of the bullet each cycle
// //     update: function (time, delta)
// //     {
// //         this.x += this.xSpeed * delta;
// //         this.y += this.ySpeed * delta;
// //         this.born += delta;
// //         if (this.born > 1800)
// //         {
// //             this.setActive(false);
// //             this.setVisible(false);
// //         }
// //     }

// // });
