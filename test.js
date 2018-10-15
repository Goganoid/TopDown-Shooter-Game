var Matter = require('matter-js/build/matter.js');

var engine = Matter.Engine.create();

var boxA = Matter.Bodies.rectangle(400, 200, 80, 80);
var boxB = Matter.Bodies.rectangle(450, 50, 80, 80);
var ground = Matter.Bodies.rectangle(400, 610, 810, 60, { isStatic: true });

Matter.World.add(engine.world, [boxA,ground]);
engine.world.gravity.y = 0;
console.log('boxA', boxA.position);
console.log('boxB', boxB.position);


// Matter.Events.trigger(engine, 'tick', { timestamp: engine.timing.timestamp });
// // console.log(engine.timing.timestamp)

// Matter.Events.trigger(engine, 'afterTick', { timestamp: engine.timing.timestamp });
// }
setInterval(function(){
    // Matter.Engine.run(engine);
    Matter.Engine.update(engine, engine.timing.delta);
    Matter.Events.on(engine, "afterUpdate", function(){
                console.log(boxA.position)
            })
},1000/60)


// setTimeout(()=>{
//     console.log('boxA', boxA.position);
//     console.log('boxB', boxB.position);
// },3000 )
