import Stats from "./js/stats.module.js";
import { GLTFLoader } from "./js/GLTFLoader.js";
import { OrbitControls } from "./js/OrbitControls.js";
import { GUI } from "./js/dat.gui.module.js";
// import * as Pathfinding from "./js/three-pathfinding.js";

let scene, renderer, camera, stats;
let model, skeleton, mixer, clock, mixer2;
let mesh;

let close, notClose, veryClose;

const crossFadeControls = [];

let currentBaseAction = "Idle";
const allActions = [];
const baseActions = {
    Idle: { weight: 1 },
    Idle_02: { weight: 0 },
    Idle_03: { weight: 0 },
    Walk_Cycle: { weight: 0 },
    Slow_Run: { weight: 0 },
    Fast_Run: { weight: 0 },
};
const additiveActions = {
    "Hug Animation": { weight: 0 },
};
let panelSettings, numAnimations;

const mouse = new THREE.Vector2(1, 1);
const raycaster = new THREE.Raycaster();

init();

function init() {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 1, 150);
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 20, 10);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(3, 10, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 400;
    scene.add(dirLight);

    mesh = new THREE.Mesh(
        new THREE.CircleGeometry(600, 32, 0),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.name = "ground";
    scene.add(mesh);

    veryClose = new THREE.Mesh(new THREE.RingGeometry(0, 6, 32), new THREE.MeshPhongMaterial({ color: 0x888888 }));
    veryClose.rotation.x = -Math.PI / 2;
    veryClose.receiveShadow = true;
    veryClose.name = "Very Close!";
    scene.add(veryClose);

    close = new THREE.Mesh(new THREE.RingGeometry(6, 10, 32), new THREE.MeshPhongMaterial({ color: 0x999999 }));
    close.rotation.x = -Math.PI / 2;
    close.receiveShadow = true;
    close.name = "Close!";
    scene.add(close);

    notClose = new THREE.Mesh(new THREE.RingGeometry(10, 14, 32), new THREE.MeshPhongMaterial({ color: 0x888888 }));
    notClose.rotation.x = -Math.PI / 2;
    notClose.receiveShadow = true;
    notClose.name = "Not Close!";
    scene.add(notClose);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const loader = new GLTFLoader();

    //load person in the middle
    loader.load(
        "/assets/model.gltf",
        function (gltf) {
            const model2 = gltf.scene;
            scene.add(model2);
            model2.traverse(function (object) {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                    object.material.color.set(0xff2222);
                }
            });
            const clonedMesh = model2.getObjectByName("SimpleCharacter");
            mixer2 = startAnimation(clonedMesh, gltf.animations, "Idle_02");
        });

    loader.load(
        "/assets/model.gltf",
        function (gltf) {
            model = gltf.scene;
            model.position.z = 20;
            scene.add(model);

            model.traverse(function (object) {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                    object.material.color.set(0x2222ff);
                };
            });

            skeleton = new THREE.SkeletonHelper(model);
            skeleton.visible = false;
            scene.add(skeleton);

            const animations = gltf.animations;
            mixer = new THREE.AnimationMixer(model);

            numAnimations = animations.length;

            for (let i = 0; i !== numAnimations; ++i) {
                let clip = animations[i];
                const name = clip.name;

                if (baseActions[name]) {
                    const action = mixer.clipAction(clip);
                    activateAction(action);
                    baseActions[name].action = action;
                    allActions.push(action);
                } else if (additiveActions[name]) {
                    // Make the clip additive and remove the reference frame

                    THREE.AnimationUtils.makeClipAdditive(clip);

                    if (clip.name.endsWith("_pose")) {
                        clip = THREE.AnimationUtils.subclip(
                            clip,
                            clip.name,
                            2,
                            3,
                            30
                        );
                    }

                    const action = mixer.clipAction(clip);
                    activateAction(action);
                    additiveActions[name].action = action;
                    allActions.push(action);
                }
            }

            // createPanel();

            mixer.timeScale = 2;

            animate();
        },
        undefined,
        function (error) {
            console.error(error);
        }
    );

    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        1,
        100
    );
    camera.position.set(-1, 50, 50);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.target.set(0, 1, 0);
    controls.update();

    stats = new Stats();
    // container.appendChild(stats.dom);

    window.addEventListener("resize", onWindowResize, false);
    container.addEventListener("click", onClick);
}

function createPanel() {
    const panel = new GUI({ width: 310 });

    const folder1 = panel.addFolder("Base Actions");
    const folder2 = panel.addFolder("Additive Action Weights");
    const folder3 = panel.addFolder("General Speed");

    panelSettings = {
        "modify time scale": 1.0,
    };

    const baseNames = ["None", ...Object.keys(baseActions)];

    for (let i = 0, l = baseNames.length; i !== l; ++i) {
        const name = baseNames[i];
        const settings = baseActions[name];
        panelSettings[name] = function () {
            const currentSettings = baseActions[currentBaseAction];
            const currentAction = currentSettings
                ? currentSettings.action
                : null;
            const action = settings ? settings.action : null;

            prepareCrossFade(currentAction, action, 0.35);
        };

        crossFadeControls.push(folder1.add(panelSettings, name));
    }

    for (const name of Object.keys(additiveActions)) {
        const settings = additiveActions[name];

        panelSettings[name] = settings.weight;
        folder2
            .add(panelSettings, name, 0.0, 1.0, 0.01)
            .listen()
            .onChange(function (weight) {
                setWeight(settings.action, weight);
                settings.weight = weight;
            });
    }

    folder3
        .add(panelSettings, "modify time scale", 0.0, 1.5, 0.01)
        .onChange(modifyTimeScale);

    folder1.open();
    folder2.open();
    folder3.open();

    crossFadeControls.forEach(function (control) {
        control.classList1 =
            control.domElement.parentElement.parentElement.classList;
        control.classList2 =
            control.domElement.previousElementSibling.classList;

        control.setInactive = function () {
            control.classList2.add("control-inactive");
        };

        control.setActive = function () {
            control.classList2.remove("control-inactive");
        };

        const settings = baseActions[control.property];

        if (!settings || !settings.weight) {
            control.setInactive();
        }
    });
}

function animate() {
    // Render loop
    TWEEN.update();

    requestAnimationFrame(animate);

    for (let i = 0; i !== numAnimations; ++i) {
        const action = allActions[i];
        const clip = action.getClip();
        const settings = baseActions[clip.name] || additiveActions[clip.name];
        settings.weight = action.getEffectiveWeight();
    }

    // Get the time elapsed since the last frame, used for mixer update

    const mixerUpdateDelta = clock.getDelta();

    // Update the animation mixer, the stats panel, and render this frame

    mixer.update(mixerUpdateDelta);
    mixer2.update(mixerUpdateDelta);

    stats.update();

    renderer.render(scene, camera);
}

function startAnimation(skinnedMesh, animations, animationName) {

    const newMixer = new THREE.AnimationMixer(skinnedMesh);
    const clip = THREE.AnimationClip.findByName(animations, animationName);

    if (clip) {

        const action = newMixer.clipAction(clip);
        action.play();

    }

    return newMixer;

}

function activateAction(action) {
    const clip = action.getClip();
    const settings = baseActions[clip.name] || additiveActions[clip.name];
    setWeight(action, settings.weight);
    action.play();
}
function modifyTimeScale(speed) {
    mixer.timeScale = speed;
}
function prepareCrossFade(startAction, endAction, duration) {
    // If the current action is 'idle', execute the crossfade immediately;
    // else wait until the current action has finished its current loop

    if (
        currentBaseAction === "Idle" ||
        currentBaseAction === "Idle_02" ||
        currentBaseAction === "Idle_03" ||
        !startAction ||
        !endAction
    ) {
        executeCrossFade(startAction, endAction, duration);
    } else {
        synchronizeCrossFade(startAction, endAction, duration);
    }

    // Update control colors

    if (endAction) {
        const clip = endAction.getClip();
        currentBaseAction = clip.name;
    } else {
        currentBaseAction = "None";
    }

    crossFadeControls.forEach(function (control) {
        const name = control.property;

        if (name === currentBaseAction) {
            control.setActive();
        } else {
            control.setInactive();
        }
    });
}
function synchronizeCrossFade(startAction, endAction, duration) {
    mixer.addEventListener("loop", onLoopFinished);

    function onLoopFinished(event) {
        if (event.action === startAction) {
            mixer.removeEventListener("loop", onLoopFinished);

            executeCrossFade(startAction, endAction, duration);
        }
    }
}
function executeCrossFade(startAction, endAction, duration) {
    // Not only the start action, but also the end action must get a weight of 1 before fading
    // (concerning the start action this is already guaranteed in this place)
    if (endAction) {
        setWeight(endAction, 1);
        endAction.time = 0;

        if (startAction) {
            // Crossfade with warping

            startAction.crossFadeTo(endAction, duration, true);
        } else {
            // Fade in

            endAction.fadeIn(duration);
        }
    } else {
        // Fade out

        startAction.fadeOut(duration);
    }
}
function setWeight(action, weight) {
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onClick(event) {

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse.clone(), camera);

    const intersection = raycaster.intersectObject(mesh);

    if (intersection.length > 0) {

        TWEEN.removeAll();

        let target = intersection[0];

        let time = distanceTiming(model.position, target.point);

        let tween = new TWEEN.Tween(model.position).to(target.point, time * 100);
        tween.start();
        tween.onStart(() => {
            model.lookAt(target.point);
            prepareCrossFade(baseActions[currentBaseAction].action, baseActions['Slow_Run'].action, 0.35);
        })
        tween.onComplete(() => {
            prepareCrossFade(baseActions[currentBaseAction].action, baseActions['Idle'].action, 0.35);
            tween.stop();
        })
        tween.onUpdate(() => {
            document.getElementById('score').innerHTML = friendshipCalculating();
            validateForm()

        })
        tween.onStop(() => {
            TWEEN.removeAll();
        })
    }

    renderer.render(scene, camera);

    stats.update();
}

function distanceTiming(first, second) {
    return Math.sqrt(Math.pow(second.x - first.x, 2) + Math.pow(second.y - first.y, 2) + Math.pow(second.z - first.z, 2));
}

function friendshipCalculating() {
    // const position = new THREE.Vector2(model.position.x / 50 + 1, model.position.z / 50 - 1);
    // console.log(model);
    // raycaster.setFromCamera(position, camera);

    // const newRaycaster = new THREE.Raycaster(model.position, camera);
    // console.log(model.position);
    // var intersects = newRaycaster.intersectObjects([model.children[0], close, notClose, veryClose], true);
    // console.log(model)
    // if (intersects.length) {
    //     console.log(intersects)
    // intersects.forEach(intersect => {
    //     console.log(intersect.object.name)
    //     if (intersect.object.name !== mainCharacter.name)
    //         return intersect.object.name;
    // })
    // }
    const position = new THREE.Vector2(model.position.x, model.position.z);
    const d = Math.sqrt(Math.pow(position.x, 2) + Math.pow(position.y, 2));
    if (d < 6) {
        lightenUp(veryClose);
        return 'Very Close!';
    } else if (d < 10) {
        lightenUp(close);
        return 'Close!';
    } else if (d < 14) {
        lightenUp(notClose);
        return 'Not Close!';
    }
    lightenUp();
    return '';

}

function lightenUp(status) {
    veryClose.material.color.set(0x888888);
    close.material.color.set(0x999999);
    notClose.material.color.set(0x888888);

    if (status) status.material.color.set(0xffffff);
}

function validateForm() {
    if (document.getElementById('score').innerHTML) {
        document.getElementById("button").disabled = false;
        return true;
    }
    document.getElementById("button").disabled = true;
    return false;
}