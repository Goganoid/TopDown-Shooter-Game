


var config = {
    type: Phaser.AUTO,
    width: 900,
    height: 900,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};
var game = new Phaser.Game(config);

function preload ()
{
    
        this.load.image('sky', 'assets/sky.png');
        this.load.image('circle', 'assets/circle.png');
        this.load.image('ground', 'assets/platform.png');
        this.load.image('white', 'assets/white.png');
        this.load.image('white-h', 'assets/white-h.png');
        this.load.image('star', 'assets/star.png');
        this.load.tilemapTiledJSON('map', 'assets/map.json');
        this.load.image('reticle', 'assets/bomb.png');
        this.load.image('tile', 'assets/background.png');
        this.load.spritesheet('dude', 
            'assets/dude.png',
            { frameWidth: 32, frameHeight: 48 }
        );
    
}
var platforms,score,scoreText,gameOver,lives,reticle,prevPos,map,boxes, positionOnCollide;

function create ()
{

    
    map = this.make.tilemap({ key: 'map' });
    var tiles = map.addTilesetImage('background', 'tile');
    var layer = map.createStaticLayer(0, tiles, 0, 0);

   
    score=0;
    scoreText=this.add.text(16,16,'score:0',{fontSize:"32px",fill:"#000"});
    player = this.physics.add.sprite(100, 450, 'circle');
        player.setScale(0.03)
        player.body.allowGravity=false;
        player.body.bounce.x=0;
        player.body.bounce.y=0;
        player.setCollideWorldBounds(true);
        player.body.syncBounds=true;
    // cursors = this.input.keyboard.createCursorKeys();
   cursors = this.input.keyboard.addKeys({
        'up': Phaser.Input.Keyboard.KeyCodes.W,
        'down': Phaser.Input.Keyboard.KeyCodes.S,
        'left': Phaser.Input.Keyboard.KeyCodes.A,
        'right': Phaser.Input.Keyboard.KeyCodes.D,
        'activate': Phaser.Input.Keyboard.KeyCodes.F
    }); 
    platforms = this.physics.add.staticGroup();
        platforms.create(400, 568, 'ground').setScale(2).refreshBody();
        platforms.create(600, 400, 'ground');
        
        platforms.create(1920, 1920, 'ground');
    platforms.children.iterate(function(f){
        f.body.bounce.x=0;
        f.body.bounce.y=0;
    });  

     boxes = this.physics.add.staticGroup();
      boxes.create(100,200, 'ground').setScale(0.1,1).refreshBody();
 
    stars = this.physics.add.group({
        key: 'star',
        repeat: 11,
        setXY: { x: 12, y: 0, stepX: 70 }
        });
        stars.children.iterate(function (child) {
        child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
        });
        this.physics.add.collider(stars,platforms)
        this.physics.add.overlap(player,stars,collectStar,null,this)
    
    bombs = this.physics.add.group();
        this.physics.add.collider(bombs, platforms);
        this.physics.add.collider(player, bombs, hitBomb, null, this);

    reticle = this.physics.add.sprite(player.x,player.y, 'reticle');
        reticle.setOrigin(0.5, 0.5).setCollideWorldBounds(true)
        reticle.body.allowGravity=false;  
        reticle.body.bounce.y=0;  
        reticle.body.bounce.x=0;  

    this.physics.add.collider(player,platforms)    
    // this.physics.add.collider(reticle,platforms)   
    this.physics.add.collider(player,boxes,function(box){

   
    if($("#ui").attr("class")!="pick"){
        $("#ui").removeClass();
        $("#ui").addClass("pick");
        $("#ui").append('<div id="DD">dd</div>')
    }
    positionOnCollide={x:player.x,y:player.y};
    }); 


  
    
    this.physics.world.setBounds(0,0,map.widthInPixels, map.heightInPixels)
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
   
    prevPos={x:player.x,y:player.y};

// console.log(map.widthInPixels)
        // this.input.on('pointermove', function (pointer) {
        //    console.log(pointer.x)
        //             // reticle.x=pointer.x;
        //             // reticle.y=pointer.y
        //             // reticle.setVelocityY(pointer.movementY*60) 
            
        //     }, this)  

            var camera = this.cameras.main;
            //camera.zoomTo(0.4)
            camera.startFollow(player);
            
              
}
function update(){
  

if(positionOnCollide!=undefined){
    if(player.x!=positionOnCollide.x || player.y!=positionOnCollide.y){
        $("#DD").remove();
        $("#ui").removeClass();
    }
}


player.setVelocityX(0);
player.setVelocityY(0);
 if(cursors.left.isDown){
     player.setVelocityX(-360);
    // player.anims.play("left",true);
 }
 else if(cursors.right.isDown){
    player.setVelocityX(360);
   // player.anims.play("right",true);
}
else{
    player.setVelocityX(0);
   // player.anims.play("turn");
}
if(cursors.up.isDown){
    player.setVelocityY(-360);
   // player.anims.play("left",true);
}
if(cursors.down.isDown){
    player.setVelocityY(360);
   // player.anims.play("left",true);
}

constrainReticle(reticle,player);



// prevPos={x:player.x,y:player.y};



}
function collectStar(player,star){
 star.disableBody(true,true )
 score+=10;
 scoreText.setText("score: "+score)
 if(stars.countActive===0){
     stars.children.iterate(function(child){
         child.enableBody(true,child.x,0,true,true)
     });
 }
//  var x=(player.x < 400) ? Phaser.Math.Between(400, 800) : Phaser.Math.Between(0, 400);
//  var bomb=bombs.create(x,16,"bomb");
//     bomb.setBounce(1);
//     bomb.setCollideWorldBounds(true);
//     bomb.setVelocity(Phaser.Math.Between(-200,200),20);
//     bomb.allowGravity=false;
//     this.physics.add.collider(bomb,bombs)
}
function constrainReticle(reticle,player){
    if(player.x>4350)  reticle.x=game.input.mousePointer.x+3900;
    else if(player.x>=450) reticle.x=game.input.mousePointer.x+(player.x-450);
    else reticle.x=game.input.mousePointer.x
    if(player.y>4350)  reticle.y=game.input.mousePointer.y+3900;
    else if(player.y>=450) reticle.y=game.input.mousePointer.y+(player.y-450);
    else reticle.y=game.input.mousePointer.y
}

function checkOverlap(spriteA, spriteB) {

    var boundsA = spriteA.getBounds();
    var boundsB = spriteB.getBounds();
    return Phaser.Geom.Rectangle.Intersection(boundsA, boundsB);

}


function hitBomb(player,bomb){
    score-=10;
    scoreText.setText("score: "+score)
    if(score==0){
    this.physics.pause();
    player.setTint(0xff0000);
 //   player.anims.play("turn");
    gameOver=true;
    }
}

function createwall(group,gravity,x,y,sprite,sx,sy){
    let wall= group.create(x,y,sprite);
    wall.body.allowGravity=false;
    wall.setScale(sx,sy)
    wall.body.immovable = true;
}
