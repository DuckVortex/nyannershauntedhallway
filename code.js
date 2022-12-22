// Javascript code for the game.
// Last updated 12/21/2022 by DuckVortex

// constants
const HORIZONTAL_RADIANS = 0;
const VERTICAL_RADIANS = Math.PI / 2;
const NUM_DOORS = 11;

const DOOR_CLOSED = 0;
const DOOR_OPENING = 1;
const DOOR_OPEN = 2;
const DOOR_CLOSING = 3;

const ARM_HIDDEN = 0;
const ARM_RISING = 1;
const ARM_UP = 2;
const ARM_LOWERING = 3;

// total number of meshes to load
const TOTAL_MESHES = 38;

// minimum delay between attacks
const MIN_DELAY = 14000;

// amount by which attack times may vary
const VARY_DELAY = 8000;

// time limit from attack start to end
const TIMEOUT = 16000;

const GAME_LOADING = 0;
const GAME_START = 1;
const GAME_PLAYING = 2;
const GAME_DIED = 3;
const GAME_ESCAPED = 4;
let gameMode = -1;

// state variables
var playerX = 0;
var playerY = 300;
var playerZ = 0;
var playerSpeed = 30;  // faster in dev mode
var playerYVel = 0;
var playerHeight = 270;

let meshesLoaded = 0;

// all meshes that can be collided with
const collideMeshes = ["crate002_Material #51_0", "GothicCommode_01_door01", "round_wooden_table_01", "steel_frame_shelves_01", "pCylinder2_lambert2_0", "ClassicNightstand_01"];

// DOOR STATE

// used to assign a unique number to each door
let doorCount = 0;

// tracks the closed (0) or open (1) status of each door
const trackOpenDoors = [];
for(let i = 0; i < NUM_DOORS; i++) {
    trackOpenDoors.push(DOOR_CLOSED);
}

// time since the door opened (-1 if not open)
let timeDoorOpen = -1;

// index of the current open door in allDoors
let curOpenDoorIndex = -1;

// true if the door monster is currently active, false otherwise
let doorMonsActive = false;

// ARM STATE

// tracks the status of the arm
let trackArm = ARM_HIDDEN;

// time when arm began rising out of toilet, -1 if not currently up
let timeArmUp = -1;

// TV STATE

// true if TV is on, false otherwise
let trackTV = false;

// time when TV turned on, -1 if not on
let timeTVOn = -1;

// array of all wall meshes
const allWalls = [];

// array of all platform meshes
const allPlatforms = [];

const allDoors = [];

let chestAnim = null;
let chestOpen = false;

let hasKey = false;
let itemsFound = 0;

// marks the timestamp of the start of the jumpscare, -1 before jumpscare starts
timeSinceScare = -1;

// the timestamp of the last attack (any of them)
let timeOfLastAttack = Date.now() + 5000;

// The time delay between each attack.
// Decreases over time as the game gets harder.
let nextDelay = 5000;

let endingScreenShown = false;

//-----------------------------------------------------------------------------------------------------
// SET UP THE SCENE

var canvas = document.getElementById("render-canvas");
var engine = new BABYLON.Engine(canvas);
var scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color3(0.8, 0.9, 0.99);
var camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(playerX, playerY, playerZ), scene);
camera.rotation.y = Math.PI / 2;
var light2 = new BABYLON.PointLight("light", new BABYLON.Vector3(0, 500, -3000), scene);
light2.intensity = 0.2;//0.5;
const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 0.7;

// makes emissive materials glow
var gl = new BABYLON.GlowLayer("glow", scene);
// note: vary this to make the lights flicker

scene.createDefaultEnvironment();

// create the camera mouse controls
scene.activeCamera = camera;
scene.activeCamera.attachControl(canvas, true);
camera.inputs.removeByType("FreeCameraKeyboardMoveInput"); // remove movement by arrow keys (use WASD instead)

// CREATE ALL SOUNDS
const doorCreak = new BABYLON.Sound("creak", "sounds/DoorCreak.wav", scene);
doorCreak.setPlaybackRate(0.7);

const toiletSound = new BABYLON.Sound("flush", "sounds/Ripples.wav", scene);
const flushSound = new BABYLON.Sound("flush", "sounds/Plunge.wav", scene);

const screamSound = new BABYLON.Sound("scream", "sounds/scream.mp3", scene);
screamSound.setVolume(3);

const devotionSound = new BABYLON.Sound("devo", "sounds/devotion.mp3", scene);

const staticSound = new BABYLON.Sound("static", "sounds/static.mp3", scene);

const crackSound = new BABYLON.Sound("crack", "sounds/crack.mp3", scene);

const peeSound = new BABYLON.Sound("pee", "sounds/nypee.mp3", scene);

const laughSound = new BABYLON.Sound("laugh", "sounds/laugh.mp3", scene);

const collectSound = new BABYLON.Sound("collect", "sounds/clickAudio.wav", scene);

const doorClose = new BABYLON.Sound("close", "sounds/Doorclo.wav", scene);

const startSound = new BABYLON.Sound("start", "sounds/longSweepAudio.wav", scene);

// add dark filter to camera
// var postProcess = new BABYLON.ImageProcessingPostProcess("processing", 1.0, camera);
//     postProcess.vignetteWeight = 1;
//     postProcess.vignetteStretch = 8;
//     postProcess.vignetteColor = new BABYLON.Color3(0, 0, 0, 0);
//     postProcess.vignetteEnabled = true;
// add grain filter to camera
// var postProcess1 = new BABYLON.GrainPostProcess("bandw", 1.0, camera);

//-----------------------------------------------------------------------------------------------------
// ADD KEYPRESS CONTROL LISTENERS

document.addEventListener('keydown', keyDownHandler, false);
document.addEventListener('keyup', keyUpHandler, false);
var rightPressed = false;
var leftPressed = false;
var upPressed = false;
var downPressed = false;
var moving = false;
function keyDownHandler(event) {
    moving = true;
    if(event.keyCode === 68) {
        rightPressed = true;
    }
    else if(event.keyCode === 65) {
        leftPressed = true;
    }
    if(event.keyCode === 83) {
      downPressed = true;
    }
    else if(event.keyCode === 87) {
      upPressed = true;
    }
}

function keyUpHandler(event) {
    moving = false;
    if(event.keyCode === 68) {
        rightPressed = false;
    }
    else if(event.keyCode === 65) {
        leftPressed = false;
    }
    if(event.keyCode === 83) {
      downPressed = false;
    }
    else if(event.keyCode === 87) {
      upPressed = false;
    }
}

//-----------------------------------------------------------------------------------------------------
// LIST OF COMMONLY USED MATERIALS

// material for walls dividing each room
const wallMat = new BABYLON.StandardMaterial("wallMat");
wallMat.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/wallrep.jpg", scene);
wallMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/wallrep.jpg", scene);
wallMat.emissiveTexture.uScale = 8;
wallMat.emissiveTexture.vScale = 3;
wallMat.diffuseTexture.uScale = 8;
wallMat.diffuseTexture.vScale = 3;

// material for left and right border wall
const wallMat2 = new BABYLON.StandardMaterial("wallMat2");
wallMat2.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/wallrep.jpg", scene);
wallMat2.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/wallrep.jpg", scene);
wallMat2.diffuseTexture.uScale = 20;
wallMat2.diffuseTexture.vScale = 3;
wallMat2.emissiveTexture.uScale = 20;
wallMat2.emissiveTexture.vScale = 3;

// material for ceiling wall
const wallMat3 = new BABYLON.StandardMaterial("wallMat3");
wallMat3.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/ceilingtilerep.jpg", scene);
wallMat3.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/ceilingtilerep.jpg", scene);
wallMat3.diffuseTexture.uScale = 10;
wallMat3.diffuseTexture.vScale = 10;
wallMat3.emissiveTexture.uScale = 10;
wallMat3.emissiveTexture.vScale = 10;
wallMat3.specularColor = new BABYLON.Color3(0, 0, 0);

const skyMat = new BABYLON.StandardMaterial("skyMat");
skyMat.emissiveTexture = new BABYLON.Texture("https://videohive.img.customer.envatousercontent.com/files/fa247550-9b66-49f9-a96f-f275d270626b/inline_image_preview.jpg?auto=compress%2Cformat&fit=crop&crop=top&max-h=8000&max-w=590&s=63bd750a2d25cb7a5058f1c87fbfac26", scene);

const doorMonsMat = new BABYLON.StandardMaterial("doorMonsMat");
//doorMonsMat.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/Zombie.webp", scene);
let diffTex = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/finalnyan.png", scene);
diffTex.hasAlpha = true;
doorMonsMat.diffuseTexture = diffTex;
// remove below to create shadow monster effect
doorMonsMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/finalnyan.png", scene);
//doorMonsMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/Zombie.webp", scene);
doorMonsMat.useAlphaFromDiffuseTexture = true;
doorMonsMat.specularColor = new BABYLON.Color3(0, 0, 0);

const mggpMat = new BABYLON.StandardMaterial("mggpMat");
let mggpdiffTex = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/mggp.png", scene);
mggpdiffTex.hasAlpha = true;
mggpMat.diffuseTexture = mggpdiffTex;
mggpMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/mggp.png", scene);
mggpMat.useAlphaFromDiffuseTexture = true;
mggpMat.specularColor = new BABYLON.Color3(0, 0, 0);

const bloMat = new BABYLON.StandardMaterial("bloMat");
let bldiffTex = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/blmess-removebg-preview.png", scene);
bldiffTex.hasAlpha = true;
bloMat.diffuseTexture = bldiffTex;
bloMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/blmess-removebg-preview.png", scene);
bloMat.useAlphaFromDiffuseTexture = true;
bloMat.specularColor = new BABYLON.Color3(0, 0, 0);

const blueMat = new BABYLON.StandardMaterial("blueMat");
blueMat.emissiveColor = new BABYLON.Color3(0, 0.58, 0.86);

const whiteMat = new BABYLON.StandardMaterial("whiteMat");
whiteMat.emissiveColor = new BABYLON.Color3(1, 1, 1);

const blackMat = new BABYLON.StandardMaterial("blackMat");
blackMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
blackMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
blackMat.specularColor = new BABYLON.Color3(0, 0, 0);

const translucentMat = new BABYLON.StandardMaterial("translucentMat");
translucentMat.emissiveColor = new BABYLON.Color3(0, 0.4, 0.86);
translucentMat.alpha = 0.5;

const redMat = new BABYLON.StandardMaterial("redMat");
redMat.emissiveColor = new BABYLON.Color3.Red();

// for invisible objects
const invisMat = new BABYLON.StandardMaterial("invisMat");
invisMat.alpha = 0;

// for doors
const woodMat1 = new BABYLON.StandardMaterial("woodMat1");
woodMat1.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/doorpic.jpg", scene);
woodMat1.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/doorpic.jpg", scene);
woodMat1.diffuseTexture.wAng = Math.PI; 
woodMat1.emissiveTexture.wAng = Math.PI; 

// back wall
const woodWall = new BABYLON.StandardMaterial("woodWall");
woodWall.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/building_hallway/textures/plaster_baseColor.jpeg", scene);
woodWall.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/building_hallway/textures/plaster_baseColor.jpeg", scene);
woodWall.diffuseTexture.uScale = 6;
woodWall.diffuseTexture.vScale = 6;
woodWall.emissiveTexture.uScale = 6;
woodWall.emissiveTexture.vScale = 6;

const carpetMat = new BABYLON.StandardMaterial("carpetMat");
carpetMat.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/graycarpet.jpg", scene);
carpetMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/graycarpet.jpg", scene);
carpetMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
carpetMat.diffuseTexture.uScale = 30.0;
carpetMat.diffuseTexture.vScale = 30.0;
carpetMat.emissiveTexture.uScale = 30.0;
carpetMat.emissiveTexture.vScale = 30.0;

const signMat = new BABYLON.StandardMaterial("signmat");
signMat.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/message.png", scene);
signMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/message.png", scene);
signMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

const bathroomMat = new BABYLON.StandardMaterial("bathmat");
bathroomMat.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/unisex-restroom-sign-decal-9.png", scene);
bathroomMat.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/unisex-restroom-sign-decal-9.png", scene);
bathroomMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

const vidMat = new BABYLON.StandardMaterial("vidMat");
vidMat.diffuseTexture = new BABYLON.VideoTexture("video", "vhsstream.mp4", scene, true);
vidMat.emissiveTexture = new BABYLON.VideoTexture("video", "vhsstream.mp4", scene, true);

function distance(x1, y1, x2, y2){
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

//------------------------------------------------------------------------------
// BUILD GUI
// Creates a gui
let advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

const style = advancedTexture.createStyle();
style.fontSize = 24;
style.fontFamily = "Courier New";

const bigstyle = advancedTexture.createStyle();
bigstyle.fontSize = 50;
bigstyle.fontStyle = "bold";
bigstyle.fontFamily = "Courier New";

var displayMessage = new BABYLON.GUI.TextBlock();
displayMessage.top = 300;
displayMessage.fontSize = 24;
displayMessage.color = "white";
displayMessage.style = style;
displayMessage.zIndex = 7;

var title = new BABYLON.GUI.TextBlock();
title.top = -300;
title.color = "white";
title.style = bigstyle;
title.text = "Nyanners' Haunted Hallway";

// jumpscare image
let scarePic = new BABYLON.GUI.Image("jumpscare", "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/finalnyan.png");
scarePic.widthInPixels = 800;
scarePic.heightInPixels = 1600;
scarePic.top = 450;

// loading image
let loadPic = new BABYLON.GUI.Image("jumpscare", "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/textures/loadscreen.png");
loadPic.widthInPixels = 2000;
loadPic.heightInPixels = 1000;

const backupLoad = BABYLON.GUI.Button.CreateSimpleButton("backup", "");
backupLoad.widthInPixels = 2000;
backupLoad.heightInPixels = 2000;
backupLoad.background = "black";

// starting image
const startPic = BABYLON.GUI.Button.CreateSimpleButton("startpic", "\nYou are trapped in an abandoned hallway, and the VTuber/eldritch horror Nyatasha Nyanners is coming to drain your sanity. Will you survive? \n\nClick and drag with the mouse to look around. \n\nUse the WASD keys to move. \n\nClick on objects to interact with them. \n\nNyanners will attempt to break in through the TV, doors, and toilet. Stop her before it’s too late. Different sounds will alert you to danger, so make sure your sound is on. \n\n\n\n\n\n\n\n\n\nThis game is not designed for mobile devices.\nThanks to SushiKev3d, jimbogies, Brandon Westlake, Aki_Kato, TheFalkonett, 1-3D.com, Elinor Quittner, Citflo, Jochon, and Poly Haven for some of the 3D assets.\nThanks to Nyanners for being a funny pink cat.");
startPic.widthInPixels = 2000;
startPic.heightInPixels = 2000;
startPic.background = "black";
startPic.color = "white";
startPic.zIndex = 0;

const textScreen = BABYLON.GUI.Button.CreateSimpleButton("textScreen", "");
textScreen.widthInPixels = 2000;
textScreen.heightInPixels = 2000;
textScreen.background = "black";
textScreen.color = "white";
textScreen.zIndex = 10;
textScreen.style = style;

displayMessage.onPointerUpObservable.add(function() {
    if(gameMode == GAME_START) {
        // clicked on the start page, start the game
        advancedTexture.removeControl(startPic);
        advancedTexture.removeControl(title);
        displayMessage.text = "";
        gameMode = GAME_PLAYING;
        timeOfLastAttack = Date.now() + 5000;
        collectSound.play();
    }
});

textScreen.onPointerUpObservable.add(function() {
    if(gameMode == GAME_DIED && timeSinceScare == -1) {
        // if on death screen
        displayMessage.text = "";
        textScreen.textBlock.text = "";
        setupGameState();
        advancedTexture.removeControl(textScreen);
    }
});


scene.onPointerDown = function castRay() {
    var ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
    var hit = scene.pickWithRay(ray);
    if (hit.pickedMesh && gameMode == GAME_PLAYING) {
        // displayMessage.text = hit.pickedMesh.name;  // debug (displays the name of selected mesh)

        // only doors have 1-digit or 2 digit names, so check if the clicked mesh is a door
        if(hit.pickedMesh.name.length == 1 || hit.pickedMesh.name.length == 2) {
            let doorIndex = parseInt(hit.pickedMesh.name);
            // if the door is open or opening, and is close enough, close it
            if((trackOpenDoors[doorIndex] == DOOR_OPEN || trackOpenDoors[doorIndex] == DOOR_OPENING)
                && distance(playerX, playerZ, 
                    allDoors[doorIndex].position.x, 
                    allDoors[doorIndex].position.z) < 800) {
                trackOpenDoors[doorIndex] = DOOR_CLOSING;
                timeDoorOpen = -1; // indicate that the door attack is finished
                curOpenDoorIndex = -1;
                doorClose.play();
            }
        } else if((hit.pickedMesh.name == "pCylinder5_lambert2_0" || hit.pickedMesh.name == "pCube24_lambert2_0")
                    && (trackArm == ARM_RISING || trackArm == ARM_UP)
                    && distance(playerX, playerZ, 1950, 1500) < 500) {
            // flush toilet
            trackArm = ARM_LOWERING;
            timeArmUp = -1;
            flushSound.play();
        } else if((hit.pickedMesh.name == "stream" || hit.pickedMesh.name == "led_tv_phong1_0") 
                && trackTV
                && distance(playerX, playerZ, -2000, 0) < 500) {
            // turn off TV
            trackTV = false;
            timeTVOn = -1;
            vidMat.pause();
        } else if(hit.pickedMesh.name == "ChestLowPoly_ChestFull_0" || hit.pickedMesh.name == "Object_10") {
            if(hasKey) {
                // open the chest
                if(!chestOpen) {
                    displayMessage.text = "Unlocked the chest.";
                    chestAnim[0].stop();
                    chestAnim[1].start(false);
                    chestOpen = true;
                    scene.getMeshByName("ChestLowPoly_ChestFull_0").isPickable = false;
                    scene.getMeshByName("Object_10").isPickable = false;
                }
            } else {
                displayMessage.text = "You need the key to unlock the chest.";
            }
        } else if(hit.pickedMesh.name == "milk_obj") {
            // take milk
            hit.pickedMesh.position.y -= 2000; // functionally removes the milk
        } else if(hit.pickedMesh.name == "Handle.001_Material_0" || 
                hit.pickedMesh.name == "Wok.001_Material_0") {
            scene.getMeshByName("Handle.001_Material_0").position.y -= 2000;
            scene.getMeshByName("Wok.001_Material_0").position.y -= 2000;
            itemsFound++;
            displayMessage.text = "You got the wok.";
            collectSound.play();
        } else if(hit.pickedMesh.name == "chickenobj") {
            hit.pickedMesh.position.y -= 2000;
            itemsFound++;
            displayMessage.text = "You got the chicken.";
            collectSound.play();
        } else if(hit.pickedMesh.name == "mushrooms_lambert1_0" || 
            hit.pickedMesh.name == "mushrooms_lambert2_0") {
            scene.getMeshByName("mushrooms_lambert1_0").position.y -= 2000;
            scene.getMeshByName("mushrooms_lambert2_0").position.y -= 2000;
            itemsFound++;
            displayMessage.text = "You got the mushrooms.";
            collectSound.play();
        } else if(hit.pickedMesh.name == "defaultMaterial") {
            hit.pickedMesh.position.y -= 2000;
            displayMessage.text = "You got the key.";
            hasKey = true;
            collectSound.play();
        } else if(hit.pickedMesh.name == "Altar_Altar_Material_0") {
            if(itemsFound == 3) {
                // you win, end game
                devotionSound.play();
                gameMode = GAME_ESCAPED;
            } else {
                displayMessage.text = "You have nothing to sacrifice to Nyatasha Nyanners.";
            }
        }
    }
}


//-----------------------------------------------------------------------------------------------------
// BUILD WALL AND PLATFORM MESHES

// Creates the mesh for a wall. Takes as parameters:
// (x, y) coordinates of the center of the wall
// vertical offset from what the wall would normally be above ground level
// w (width) and h (height)
// thickness of the wall
// dir: the angle, in radians, of the wall's orientation
// texture of the wall
function buildWall(x, y, verticalOffset, w, h, thickness, dir, texture){
    const box = BABYLON.MeshBuilder.CreateBox("wall", {width:w, height:h, depth:thickness});
    box.position.x = x;
    box.position.z = y;
    box.position.y = h/2 + verticalOffset;
    box.rotation.y = dir;
    box.rotationQuaternion = null;
    box.material = texture;
    allWalls.push(box);
}

function buildDoor(x, y, verticalOffset, w, h, thickness, dir, texture){
    const box = BABYLON.MeshBuilder.CreateBox(doorCount.toString(), {width:w, height:h, depth:thickness});
    box.position.x = x;
    box.position.z = y;
    box.position.y = h/2 + verticalOffset;
    box.rotation.y = dir;
    box.rotationQuaternion = null;
    box.material = texture;
    box.setPivotPoint(new BABYLON.Vector3(-85, 0, 0));
    allDoors.push(box);
    doorCount++;
}

function buildAllWalls(){
    // make left doors
    for(var i = 0; i < 6; i++) {
        buildDoor(1896 - (i * 700), -320, 0, 153, 340, 11, HORIZONTAL_RADIANS, woodMat1);
    }

    // make right doors
    for(var i = 1; i < 6; i++) {
        buildDoor(1896 - (i * 700), 320, 0, 153, 340, 11, HORIZONTAL_RADIANS, woodMat1);
    }
    
    // make left walls
    for(var i = 0; i < 7; i++) {
        buildWall(2050 - (i * 700), -1120, 0, 1600, 700, 30, VERTICAL_RADIANS, wallMat);//blackMat);
    }

    // make right walls
    for(var i = 0; i < 7; i++) {
        buildWall(2050 - (i * 700), 1120, 0, 1600, 700, 30, VERTICAL_RADIANS, wallMat);//blackMat);
    }

    // make left border
    buildWall(350, -1800, 0, 5000, 700, 11, HORIZONTAL_RADIANS, wallMat2);//blackMat);

    // make right border
    buildWall(350, 1800, 0, 5000, 700, 11, HORIZONTAL_RADIANS, wallMat2);//blackMat);

    // make left inner border
    buildWall(0, -340, 0, 5000, 700, 30, HORIZONTAL_RADIANS, invisMat);

    // make right inner border
    buildWall(-700, 340, 0, 5000, 700, 30, HORIZONTAL_RADIANS, invisMat);

    // make end wall
    buildWall(2075, 0, 0, 2000, 1000, 30, VERTICAL_RADIANS, woodWall);

    // make front wall (invisible, since the one included in the model does not have collisions)
    buildWall(-2150, 0, 0, 2000, 1000, 30, VERTICAL_RADIANS, invisMat);

    // make sign
    buildWall(2067, 0, 200, 130, 160, 20, VERTICAL_RADIANS, signMat);

    // make sign
    buildWall(1700, 316, 200, 50, 50, 2, HORIZONTAL_RADIANS, bathroomMat);
}

buildAllWalls();

// Creates the mesh for a platform. Takes as parameters:
// (x, y) coordinates of the center of the platform
// vertical offset (how high up in the air)
// w (width) and l (length)
// thickness of the platform
// texture of the platform
function buildPlatform(x, y, verticalOffset, w, l, thickness, texture){
    const box = BABYLON.MeshBuilder.CreateBox("box", {width:w, height:thickness, depth:l});
    box.position.x = x;
    box.position.z = y;
    box.position.y = verticalOffset;
    box.material = texture;
    allPlatforms.push(box);
}

function buildAllPlatforms(){
    // ceiling
    buildPlatform(0, 0, 445, 4500, 4500, 20, wallMat3);

    // bathroom floor
    buildPlatform(1700, 1070, 1, 700, 1510, 2, wallMat3);
    
    // add platforms here
}

buildAllPlatforms();

//-----------------------------------------------------------------------------------------------------
// CREATE ADDITIONAL MESHES


// create the player box, detects collisions
var player = BABYLON.MeshBuilder.CreateCylinder("playerBox", {diameter: 10, height:playerHeight - 50});
player.position.x = playerX;
// vertically positioned right below the camera, but slightly above the floor
player.position.y = playerY - playerHeight / 2 + 10;
player.position.z = playerZ;
player.material = invisMat;

//create skybox
// var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 10000.0 }, scene);
// var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
// skyboxMaterial.backFaceCulling = false;
// skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/skybox", scene);
//alternate skyboxes
//skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/skybox2", scene);
//skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/skybox3", scene);
//skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/skybox4", scene);
// skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
// skyboxMaterial.diffuseColor = new BABYLON.Color3(100, 100, 100);
// skyboxMaterial.specularColor = new BABYLON.Color3(100, 100, 100);
// skybox.material = skyboxMaterial;

// darken PBR materials
// scene.environmentTexture = new BABYLON.CubeTexture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/skybox2", scene);

// ground
var ground = BABYLON.MeshBuilder.CreateBox("ground", {width:10000, depth:10000, height: 1});
ground.material = carpetMat;

// hallway
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/building_hallway/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       const submeshes = m5.getChildMeshes();
       submeshes[8].material = invisMat;
       submeshes[9].material = invisMat;
       submeshes[1].material = invisMat;
       m5.position.x = 0;
       m5.position.y = 2;
       m5.position.z = 0;
       m5.scaling = new BABYLON.Vector3(4, 4, 4);
       meshesLoaded++;
});

// toilet
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/toilet/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.name = "toilet";
       m5.position.x = 2000;
       m5.position.y = 0;
       m5.position.z = 1600;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
       meshesLoaded++;
});

// arm
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/arm/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.name = "arm";
       m5.position.x = 1940;
       m5.position.y = 0;
       m5.position.z = 1640;
       m5.rotationQuaternion = null;
       m5.rotation.x = -1 * Math.PI / 3;
       m5.rotation.z = -1 * Math.PI / 4;
       m5.rotation.y = Math.PI / 1.5;
       m5.scaling = new BABYLON.Vector3(0.9, 0.9, 0.9);
       meshesLoaded++;
});

// sink
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/marble_bathroom_sink_free/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1500;
       m5.position.y = 0;
       m5.position.z = 1700;
       m5.scaling = new BABYLON.Vector3(75, 75, 75);
       meshesLoaded++;
});

// chest
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/chest/",
    "scene.gltf",
    scene,
    function (newMeshes, particleSystems, skeletons, animationGroups) {          
       var m5 = newMeshes[0];
       m5.position.x = 1500;
       m5.position.y = 0;
       m5.position.z = 1000;
       m5.rotationQuaternion = null;
       m5.rotation.y = VERTICAL_RADIANS;
       chestAnim = animationGroups;
       m5.scaling = new BABYLON.Vector3(0.8, 0.8, 0.8);
       meshesLoaded++;
});

// chicken
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/roasted_chicken/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1750;
       m5.position.y = 90;
       m5.position.z = 1700;
       m5.scaling = new BABYLON.Vector3(2.3, 2.3, 2.3);
       meshesLoaded++;
});

// mushroooms
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/handpainted_mushrooms/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1405;
       m5.position.y = 80;
       m5.position.z = 394;
       m5.scaling = new BABYLON.Vector3(8, 8, 8);
       meshesLoaded++;
});

// wok
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/wok_homework10/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1500;
       m5.position.y = 20;
       m5.position.z = 1000;
       m5.scaling = new BABYLON.Vector3(0.15, 0.15, 0.15);
       meshesLoaded++;
});

// key
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/old_key/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = -2020;
       m5.position.y = 150;
       m5.position.z = 10;
       m5.scaling = new BABYLON.Vector3(100, 100, 100);
       meshesLoaded++;
});

// mirror
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/ornate_mirror_01_1k.gltf/",
    "ornate_mirror_01_1k.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1470;
       m5.position.y = 300;
       m5.position.z = 1790;
       m5.scaling = new BABYLON.Vector3(170, 170, 170);
       meshesLoaded++;
});

// altar
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/sacrificial_altar/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1985;
       m5.position.y = 0;
       m5.position.z = 0;
       m5.rotationQuaternion = null;
       m5.rotation.y = VERTICAL_RADIANS;
       m5.scaling = new BABYLON.Vector3(1, 1, 1);
       meshesLoaded++;
});

// mggp
let mggp = BABYLON.MeshBuilder.CreateBox("mggp", {width:150, depth:1, height: 100});
mggp.position.x = 2000;
mggp.position.y = 150;
mggp.position.z = 0;
mggpMat.alpha = 0; /// invisible at first
mggp.rotation.y = VERTICAL_RADIANS;
mggp.material = mggpMat;

// blood message
let blmess = BABYLON.MeshBuilder.CreateBox("blmess", {width:500, depth:1, height: 200});
blmess.position.x = 2030;
blmess.position.y = 250;
blmess.position.z = 1120;
blmess.rotation.y = VERTICAL_RADIANS;
blmess.material = bloMat;

// tv
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/led_tv/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = -2000;
       m5.position.y = 137;
       m5.position.z = 0;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(20, 20, 20);
       meshesLoaded++;
});

// tv cabinet
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/ClassicNightstand_01_1k.gltf/",
    "ClassicNightstand_01_1k.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = -2000;
       m5.position.y = 0;
       m5.position.z = 0;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(200, 200, 200);
       meshesLoaded++;
});



// DECORATION MESHES HERE -----------------------------------------
// big cabinet
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/GothicCommode_01_1k.gltf/",
    "GothicCommode_01_1k.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1430;
       m5.position.y = 0;
       m5.position.z = 600;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(150, 150, 150);
       meshesLoaded++;
});

// shelves
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/steel_frame_shelves_01_1k.gltf/",
    "steel_frame_shelves_01_1k.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1400;
       m5.position.y = 0;
       m5.position.z = 400;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(11, 11, 11);
       meshesLoaded++;
});

// put milk on shelves
for(let y = 0; y < 4; y++) {
    for(let x = 0; x < 5; x++) {
        // milk
        BABYLON.SceneLoader.ImportMesh(
            null,
            "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/lowpoly_milk/",
            "scene.gltf",
            scene,
            function (newMeshes) {          
            var m5 = newMeshes[0];
            m5.position.x = 1440;
            m5.position.y = 30 + y * 50;
            m5.position.z = 360 + x * 17;
            m5.rotationQuaternion = null;
            m5.rotation.y = Math.PI / 2;
            m5.scaling = new BABYLON.Vector3(2, 1.83, 2);
            meshesLoaded++;
        });
    }
}

// table
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/round_wooden_table_01_1k.gltf/",
    "round_wooden_table_01_1k.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1590;
       m5.position.y = 0;
       m5.position.z = 480;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(100, 100, 100);
       meshesLoaded++;
});

// crate
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/crate_box/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1795;
       m5.position.y = 0;
       m5.position.z = 1573;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(1.3, 1.3, 1.3);
       meshesLoaded++;
});

// crate 2
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/crate_box/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1780;
       m5.position.y = 80;
       m5.position.z = 1550;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(1.3, 1.3, 1.3);
       meshesLoaded++;
});

// crate 3
BABYLON.SceneLoader.ImportMesh(
    null,
    "https://raw.githubusercontent.com/Mike1795/BabylonStuff/main/old_crate/",
    "scene.gltf",
    scene,
    function (newMeshes) {          
       var m5 = newMeshes[0];
       m5.position.x = 1800;
       m5.position.y = 50;
       m5.position.z = 1700;
       m5.rotationQuaternion = null;
       m5.rotation.y = Math.PI / 2;
       m5.scaling = new BABYLON.Vector3(1.3, 1.8, 1);
       newMeshes[2].isPickable = false;
       meshesLoaded++;
});

// door monster
let doorMonster = BABYLON.MeshBuilder.CreateBox("doorMonster", {width:210, depth:5, height: 340});
doorMonster.position.y = 185;
doorMonster.position.z = 2000; // initially hidden
doorMonster.material = doorMonsMat;

let tvStream = BABYLON.MeshBuilder.CreateBox("stream", {width:230, depth:5, height: 120});
tvStream.position.x = -1980;
tvStream.position.y = 225;
tvStream.position.z = 0; 
tvStream.rotation.y = -1 * Math.PI / 2;
tvStream.material = vidMat;

// resets all game variables to play again
function setupGameState() {
    timeSinceScare = -1;
    playerX = 0;
    playerY = 300;
    playerZ = 0;
    playerSpeed = 30;  // faster in dev mode
    playerYVel = 0;
    playerHeight = 270;
    // close all doors
    for(let i = 0; i < NUM_DOORS; i++) {
        trackOpenDoors[i] = DOOR_CLOSED;
        allDoors[i].rotation.y = HORIZONTAL_RADIANS;
    }
    timeDoorOpen = -1;
    curOpenDoorIndex = -1;
    doorMonsActive = false;
    trackArm = ARM_HIDDEN;
    timeArmUp = -1;
    trackTV = false;
    timeTVOn = -1;
    chestOpen = false;
    hasKey = false;
    itemsFound = 0;
    timeOfLastAttack = Date.now() + 5000;
    nextDelay = 5000;
    endingScreenShown = false;
    mggpMat.alpha = 0;
    doorMonster.position.y = 185;
    doorMonster.position.z = 2000;
    // reshow milk and items
    for (const mesh of scene.meshes) {
        if (mesh.position.y < -500) {
            mesh.position.y += 2000;
        }
    }
    tvStream.material.alpha = 0;
    let resetarm = scene.getMeshByName("arm");
    resetarm.rotation.y = Math.PI / 1.5;
    resetarm.rotation.x = -1 * Math.PI / 3;
    resetarm.rotation.z = -1 * Math.PI / 4;
    resetarm.position.y = 0;
    scarePic.widthInPixels = 800;
    scarePic.heightInPixels = 1600;
    scarePic.top = 450;
    // make the chest pickable
    scene.getMeshByName("ChestLowPoly_ChestFull_0").isPickable = true;
    scene.getMeshByName("Object_10").isPickable = true;
    // close the chest
    chestAnim[1].stop();
    chestAnim[0].start(true);

    gameMode = GAME_PLAYING;
    
}

//-----------------------------------------------------------------------------------------------------
// RENDERING HELPER FUNCTIONS

// aligns the player box with the camera position
function setPlayerBoxToCameraPosition(){
    player.position.x = playerX;
    player.position.y = playerY - (playerHeight / 2) + 10;
    player.position.z = playerZ;
    scene.render();
}

// takes the x, y, and z coordinates that the player would occupy if the movement happens
// returns true if the incoming movement will cause a collision, false if the path is clear
function checkAllCollisions(x, y, z){
    player.position.x = x;
    player.position.y = y;
    player.position.z = z;
    scene.render();
    for(var i = 0; i < allWalls.length; i++){
        if(player.intersectsMesh(allWalls[i], true)){
            setPlayerBoxToCameraPosition();
            return true;
        }
    }
    for(var i = 0; i < allPlatforms.length; i++){
        if(player.intersectsMesh(allPlatforms[i], true)){
            setPlayerBoxToCameraPosition();
            return true;
        }
    }

    if(player.intersectsMesh(ground, true)){
        setPlayerBoxToCameraPosition();
        return true;
    }

    // add checks for intersections with other meshes as necessary
    for(let i = 0; i < collideMeshes.length; i++) {
        let curMesh = scene.getMeshByName(collideMeshes[i]);
        if(curMesh != null) {
            if(player.intersectsMesh(curMesh, true)){
                setPlayerBoxToCameraPosition();
                return true;
            }
        }
    }

    setPlayerBoxToCameraPosition();
    return false;
}

// DOOR-SPECIFIC FUNCTIONS

function openDoor(doorIndex) {
    let door = allDoors[doorIndex];
    if(doorIndex < 6) {
        if(door.rotation.y > -1 * Math.PI * 0.75) {
            door.rotation.y -= Math.PI / 100;
        } else {
            trackOpenDoors[doorIndex] = DOOR_OPEN;
        }
    } else {
        if(door.rotation.y < Math.PI * 0.75) {
            door.rotation.y += Math.PI / 100;
        } else {
            trackOpenDoors[doorIndex] = DOOR_OPEN;
        }
    }
}

function closeDoor(doorIndex) {
    let door = allDoors[doorIndex];
    if(doorIndex < 6) {
        if(door.rotation.y < 0) {
            door.rotation.y += Math.PI / 25;
        } else {
            if(doorMonsActive) {
                doorMonsActive = false;
            }
            trackOpenDoors[doorIndex] = DOOR_CLOSED;
        }
    } else {
        if(door.rotation.y > 0) {
            door.rotation.y -= Math.PI / 50;
        } else {
            if(doorMonsActive) {
                doorMonsActive = false;
            }
            trackOpenDoors[doorIndex] = DOOR_CLOSED;
        }
    }
}

/*
 * Handle starting attacks when the time is ready.
*/
function handleAttack() {
    if(Date.now() - timeOfLastAttack > nextDelay) {
        // time is ready to attack

        // pick an attack 0-3
        let attackType = Math.floor(Math.random() * 3);
        nextDelay = MIN_DELAY + Math.floor(Math.random() * VARY_DELAY);
        timeOfLastAttack = Date.now();
        if(attackType == 0 && timeDoorOpen == -1) {
            // door attack
            // choose a door 0-NUM_DOORS
            let doorToOpen = Math.floor(Math.random() * NUM_DOORS);

            // if the chosen door was already open, choose another door
            while(trackOpenDoors[doorToOpen] != DOOR_CLOSED) {
                doorToOpen++;
                // loop back to the first door
                if(doorToOpen == NUM_DOORS) {
                    doorToOpen = 0;
                }
            }

            // open the door
            trackOpenDoors[doorToOpen] = DOOR_OPENING;
            curOpenDoorIndex = doorToOpen;
            timeDoorOpen = Date.now();
            doorCreak.play();
            laughSound.play();
        } else if(attackType == 1 && timeTVOn == -1) {
            // TV attack
            trackTV = true;
            timeTVOn = Date.now();
            staticSound.play();
            crackSound.play();
        } else if(attackType == 2 && timeArmUp == -1) {
            // toilet attack
            trackArm = ARM_RISING;
            timeArmUp = Date.now();
            toiletSound.play();
            peeSound.play();
        }
    }
}

/*
 * Handle the movement (opening and closing) of doors
*/
function handleDoors() {
    for(let i = 0; i < NUM_DOORS; i++) {
        if(trackOpenDoors[i] == DOOR_OPENING) {
            openDoor(i);
        } else if(trackOpenDoors[i] == DOOR_CLOSING) {
            closeDoor(i);
        }
    }
}

// Handle the movement of the door monster
function handleDoorMonster() {
    if(timeDoorOpen != -1 && !doorMonsActive) {
        // set up monster and start moving
        doorMonster.position.x = allDoors[curOpenDoorIndex].position.x;
        if(curOpenDoorIndex < 6) {
            doorMonster.rotation.y = Math.PI;
            doorMonster.position.z = -700;
        } else {
            doorMonster.rotation.y = 0;
            doorMonster.position.z = 700;
        }
        doorMonsActive = true;
    } else if(doorMonsActive && Math.abs(doorMonster.position.z) > 380) {
        // keep moving forward
        if(doorMonster.rotation.y == Math.PI) {
            doorMonster.position.z += 1;
        } else {
            doorMonster.position.z -= 1;
        }
    }

    if(doorMonsActive) {
        // randomly jitter the monster back and forth
        if(Math.random() < 0.5) {
            doorMonster.position.x -= 1;
        } else {
            doorMonster.position.x += 1;
        }
    }
}

// Handle the movement of the arm out of the toilet
function handleArm() {
    let arm = scene.getMeshByName("arm");
    if(arm == null) {
        return null;
    }
    if(trackArm == ARM_HIDDEN) {
        arm.position.y = -200;
    } else if(trackArm == ARM_RISING) {
        if(arm.position.y == -200) {
            arm.position.y = 0;
        }
        if(arm.position.y < 70) {
            // still rising, move up
            arm.position.y += 1;
            // randomly jitter the arm back and forth
            if(Math.random() < 0.5) {
                arm.rotation.x -= 0.01;
            } else {
                arm.rotation.x += 0.01;
            }
        } else {
            // hit max height, transition to up state
            trackArm = ARM_UP;
        }
    } else if(trackArm == ARM_UP) {
        // randomly jitter the arm back and forth
        if(Math.random() < 0.5) {
            arm.rotation.x -= 0.01;
        } else {
            arm.rotation.x += 0.01;
        }
    } else if(trackArm == ARM_LOWERING) {
        if(arm.position.y > 0) {
            arm.position.y -= 2;
        } else {
            // hide and reset the arm
            trackArm = ARM_HIDDEN;
            arm.rotation.x = -1 * Math.PI / 3;
        }
    }
}

// Handle the TV turning on and off
function handleTV() {
    if(trackTV) {
        tvStream.material.alpha = 1;
    } else {
        if(tvStream.material.alpha > 0) {
            tvStream.material.alpha -= 0.05;
        }
    }
}

/*
 * Handles tips displayed at the bottom of the screen.
*/
function handleTips() {
    if(curOpenDoorIndex != -1 && distance(playerX, playerZ, 
                allDoors[curOpenDoorIndex].position.x, 
                allDoors[curOpenDoorIndex].position.z) < 800) {
        displayMessage.text = "Click on a nearby open door to close it.";
    } else if((trackArm == ARM_RISING || trackArm == ARM_UP) && 
            distance(playerX, playerZ, 1950, 1500) < 600) {
        displayMessage.text = "Use the lever to flush the toilet.";
    } else if(trackTV && distance(playerX, playerZ, -2000, 0) < 700) {
        displayMessage.text = "Click the TV to turn it off.";
    } else if(itemsFound == 3 && Math.abs(playerZ) < 100 && playerX > 1585) {
        displayMessage.text = "Click the altar to sacrifice your Moo Goo Gai Pan.";
    }
}


/*
 * Kills the player if the timeout for an attack finishes.
*/
function handleAttackOutcomes() {
    if(gameMode == GAME_PLAYING) {
        let curTime = Date.now();
        if(timeDoorOpen != -1 && curTime - timeDoorOpen > TIMEOUT) {
            jumpscareEnd();
        } else if(timeArmUp != -1 && curTime - timeArmUp > TIMEOUT) {
            jumpscareEnd();
        } else if(timeTVOn != -1 && curTime - timeTVOn > TIMEOUT) {
            jumpscareEnd();
        }   
    }
    
}

// Triggers the jumpscare
function jumpscareEnd() {
    advancedTexture.addControl(scarePic);
    timeSinceScare = Date.now();
    displayMessage.text = "";
    screamSound.play();
    // camera.detachPostProcess(postProcess);  // note remove if not using filters
    // camera.detachPostProcess(postProcess1);
    gameMode = GAME_DIED;
}

// Handles the jumpscare
function handleJumpscare() {
    if(timeSinceScare != -1) {
        // randomly jiggle the jumpscare around
        scarePic.leftInPixels += (Math.random() * 40 - 20);
        if(scarePic.widthInPixels < 900) {
            scarePic.widthInPixels *= 1.01;
            scarePic.heightInPixels *= 1.01;
        }
        if((Date.now() - timeSinceScare) > 1400){
            advancedTexture.removeControl(scarePic);
            textScreen.textBlock.text = "Nyanners consumed your sanity.\n\nClick anywhere to play again.";
            advancedTexture.addControl(textScreen);
            timeSinceScare = -1;
        }
    }
}

// Handles the final offering to Nyanners and the end of the game.
function handleOffering() {
    if(gameMode == GAME_ESCAPED) {
        if(mggpMat.alpha < 0.80) {
            mggpMat.alpha += 0.01;
        } else if(mggpMat.alpha < 1) {
            mggpMat.alpha += 0.001;
        } else {
            if(!endingScreenShown) {
                displayMessage.text = "";
                textScreen.textBlock.text = "Nyanners enjoyed your offering of Moo Goo Gai Pan.\n\nYou shall be spared.\n\nGame Over.";
                advancedTexture.addControl(textScreen);
            }
        }    
    }
}


//-----------------------------------------------------------------------------------------------------
// RENDERING LOOP

var renderLoop = function () {
    scene.render();
    if(meshesLoaded < TOTAL_MESHES) {
        // meshes are still loading, display loading screen 
        if(gameMode == -1) {
            gameMode = GAME_LOADING;
            advancedTexture.addControl(backupLoad);
            advancedTexture.addControl(loadPic);
            advancedTexture.addControl(displayMessage);
        }
        displayMessage.text = "Loading " + Math.round((meshesLoaded / TOTAL_MESHES * 100)).toString() + "% complete";
    } else if(gameMode == GAME_LOADING) {
        // meshes done loading, display start screen and wait for start
        gameMode = GAME_START;
        advancedTexture.addControl(startPic);
        advancedTexture.addControl(title);
        advancedTexture.removeControl(backupLoad);
        advancedTexture.removeControl(loadPic);
        displayMessage.text = "Click anywhere to start.";
        startSound.play();
        // pointer click handler handler the transition to playing on click
    } else if(gameMode == GAME_PLAYING) {
        // handle everything for playing the game
        handleAttack();
        handleDoors();
        handleDoorMonster();
        handleArm();
        handleTV();
        handleOffering();
        handleTips();
        handleAttackOutcomes();
        handleJumpscare();
    
        setPlayerBoxToCameraPosition();
        player.rotation.y = camera.rotation.y;

        // handle WASD movement
        if(moving){
            if(rightPressed) {
                var xchange = playerSpeed/2 * Math.sin(camera.rotation.y - Math.PI/2);
                var zchange = playerSpeed/2 * Math.cos(camera.rotation.y - Math.PI/2);
                if(!checkAllCollisions(player.position.x - xchange, player.position.y, player.position.z - zchange)){
                    playerX -= xchange;
                    playerZ -= zchange;
                    setPlayerBoxToCameraPosition();
                }
            }
            else if(leftPressed) {
                var xchange = playerSpeed/2 * Math.sin(camera.rotation.y + Math.PI/2);
                var zchange = playerSpeed/2 * Math.cos(camera.rotation.y + Math.PI/2);
                if(!checkAllCollisions(player.position.x - xchange, player.position.y, player.position.z - zchange)){
                    playerX -= xchange;
                    playerZ -= zchange;
                    setPlayerBoxToCameraPosition();
                }
            }
            if(downPressed) {
                var xchange = playerSpeed * Math.sin(camera.rotation.y);
                var zchange = playerSpeed * Math.cos(camera.rotation.y);
                if(!checkAllCollisions(player.position.x - xchange, player.position.y, player.position.z - zchange)){
                    playerX -= xchange;
                    playerZ -= zchange;
                    setPlayerBoxToCameraPosition();
                }
            }
            else if(upPressed) {
                var xchange = playerSpeed * Math.sin(camera.rotation.y);
                var zchange = playerSpeed * Math.cos(camera.rotation.y);
                if(!checkAllCollisions(player.position.x + xchange, player.position.y, player.position.z + zchange)){
                    playerX += xchange;
                    playerZ += zchange;
                    setPlayerBoxToCameraPosition();
                }
            }
        }

        if(checkAllCollisions(player.position.x, (player.position.y - 10), player.position.z)){
            // NOTE: scene.render() is needed to take into account new position adjustments for intersectsMesh()
            playerYVel = 0;
        } else {
            // if not on the floor, fall down
            if(playerYVel > -5){
                playerYVel -= 0.5;
            }
        }
        // move up or down according to the y velocity
        playerY += playerYVel;
        
        setPlayerBoxToCameraPosition();
        
        // set camera position
        camera.position.x = playerX;
        camera.position.y = playerY;
        camera.position.z = playerZ;
    } else if(gameMode == GAME_DIED) {
        handleJumpscare();
    } else if(gameMode == GAME_ESCAPED) {
        handleOffering();
    }
};
engine.runRenderLoop(renderLoop);
