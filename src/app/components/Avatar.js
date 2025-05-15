'use client';

import { useEffect, useRef } from 'react';
import { useMqtt } from './MqttProviderMock';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { VRMHumanBoneName, VRMHumanoidHelper, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { IK, IKChain, IKHelper, IKJoint } from 'three-ik';

const Avatar = () => {
  const { head, handL, handR } = useMqtt();
  const canvasRef = useRef(null);
  const vrmRef = useRef(null);

  const ikLeftTarget = useRef(null);
  const ikRightTarget = useRef(null);
  const ikRef = useRef(null);
  const lookAtTarget = useRef(null);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const ocRef = useRef(null);
  const clockRef = useRef(null);
  const labelRendererRef = useRef(null);
  const labelLRef = useRef(null);
  const labelRRef = useRef(null);

  const dummyBoneMap = {};

  const createDummyBone = (name, parent = null) => {
    const bone = new THREE.Bone();
    bone.name = name;
    if (parent) parent.add(bone);
    return bone;
  };
  const applyDummyToRealBones = (dummyBoneMap) => {
    for (const boneName in dummyBoneMap) {
      const { dummy, real, correction } = dummyBoneMap[boneName];
      dummy.updateMatrixWorld(true);

      const worldPos = dummy.getWorldPosition(new THREE.Vector3());
      const worldQuat = dummy.getWorldQuaternion(new THREE.Quaternion());
  
      if (real.parent) {
        const invParent = real.parent.matrixWorld.clone().invert();
        worldPos.applyMatrix4(invParent);
        worldQuat.premultiply(new THREE.Quaternion().setFromRotationMatrix(invParent));
      }

      if (correction) {
        const correctionQuat = new THREE.Quaternion().setFromAxisAngle(correction.axis, correction.angle);
        worldQuat.multiply(correctionQuat); // ←補正
      }
  
      real.position.copy(worldPos);
      real.quaternion.copy(worldQuat);
    }
  };
  const createDummyChain = (scene, vrm, targetObj, which="L") => {
    const upperArmName = which==="L"? VRMHumanBoneName.LeftUpperArm : VRMHumanBoneName.RightUpperArm;
    const lowerArmName = which==="L"? VRMHumanBoneName.LeftLowerArm : VRMHumanBoneName.RightLowerArm;
    const handName = which==="L"? VRMHumanBoneName.LeftHand : VRMHumanBoneName.RightHand;
    
    const upperArm = vrm.humanoid.getRawBoneNode(upperArmName);
    const lowerArm = vrm.humanoid.getRawBoneNode(lowerArmName);
    const hand = vrm.humanoid.getRawBoneNode(handName);

    const dummyRoot = new THREE.Group();
    scene.add(dummyRoot);
    const dummyUpperArm = createDummyBone(upperArmName.replace(which.toLowerCase(), "dummy" + which), dummyRoot);
    const dummyLowerArm = createDummyBone(lowerArmName.replace(which.toLowerCase(), "dummy" + which), dummyUpperArm);
    const dummyHand = createDummyBone(handName.replace(which.toLowerCase(), "dummy" + which), dummyLowerArm);

    // ダミーボーンをVRMボーンの位置に配置
    dummyLowerArm.position.copy(lowerArm.position);
    dummyHand.position.copy(hand.position);
    const worldPos = upperArm.getWorldPosition(new THREE.Vector3());
    dummyRoot.position.copy(worldPos);
    const chain = new IKChain();
    chain.add(new IKJoint(dummyUpperArm));
    chain.add(new IKJoint(dummyLowerArm));
    chain.add(new IKJoint(dummyHand), { target: targetObj });

    const yDir = which==="L"? 1 : -1;

    dummyBoneMap[upperArmName] = {
      dummy: dummyUpperArm,
      real: upperArm,
      correction: {
        axis: new THREE.Vector3(0, yDir, 0),
        angle: Math.PI / 2
      }
    };
    dummyBoneMap[lowerArmName] = {
      dummy: dummyLowerArm,
      real: lowerArm,
      correction: {
        axis: new THREE.Vector3(0, yDir, 0),
        angle: Math.PI / 2
      }
    };
    dummyBoneMap[handName] = {
      dummy: dummyHand,
      real: hand,
      correction: {
        axis: new THREE.Vector3(0, yDir, 0),
        angle: Math.PI / 2
      }
    };
    return chain;
  };

  useEffect(() => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(1, 2, 1.5);
    camera.lookAt(0, 1.2, 0);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;

    const OC = new OrbitControls(camera, renderer.domElement);
    OC.target.set(0, 1.2, 0);
    OC.update();
    ocRef.current = OC;

    const clock = new THREE.Clock();
    clockRef.current = clock;

    const axesHelper = new THREE.AxesHelper(2);
    axesHelper.renderOrder = 1000;
    scene.add(axesHelper);
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    const ikLeftObj = new THREE.Mesh(
      new THREE.SphereGeometry(0.05),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ikLeftObj.visible = true;
    scene.add(ikLeftObj);
    ikLeftTarget.current = ikLeftObj;

    const infoDiv = document.createElement('div');
    infoDiv.id = "handLLabel";
    infoDiv.className = 'label';
    infoDiv.textContent = "hoge";
    infoDiv.style.color = 'white';
    infoDiv.style.fontSize = '16px';
    infoDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
    infoDiv.style.padding = '2px 6px';
    infoDiv.style.borderRadius = '4px';
    labelLRef.current = infoDiv;
    const infoLabel = new CSS2DObject(infoDiv);
    ikLeftObj.add(infoLabel);

    const ikRightObj = new THREE.Mesh(
      new THREE.SphereGeometry(0.05),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    ikRightObj.visible = true;
    scene.add(ikRightObj);
    ikRightTarget.current = ikRightObj;

    const infoDiv2 = document.createElement('div');
    infoDiv2.id = "handLLabel";
    infoDiv2.className = 'label';
    infoDiv2.textContent = "hoge";
    infoDiv2.style.color = 'white';
    infoDiv2.style.fontSize = '16px';
    infoDiv2.style.backgroundColor = 'rgba(0,0,0,0.5)';
    infoDiv2.style.padding = '2px 6px';
    infoDiv2.style.borderRadius = '4px';
    labelRRef.current = infoDiv2;
    const infoLabel2 = new CSS2DObject(infoDiv2);
    ikRightObj.add(infoLabel2);

    const lookAtObj = new THREE.Mesh(
      new THREE.SphereGeometry(0.05),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    lookAtObj.visible = true;
    scene.add(lookAtObj);
    lookAtTarget.current = lookAtObj;

    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 1, 1).normalize();
    scene.add(light);

    const helperRoot = new THREE.Group();
    helperRoot.renderOrder = 10000;
    scene.add(helperRoot);

    const loader = new GLTFLoader();
    // Install a GLTFLoader plugin that enables VRM support
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser, {helperRoot});
    });

    loader.load(
      // '/models/AvatarSample_A.vrm',
      '/models/AliciaSolid.vrm',
      (gltf) => {
        const vrm = gltf.userData.vrm;
        VRMUtils.rotateVRM0(vrm);
        vrm.humanoid.autoUpdateHumanBones = false;
        // vrm.lookAt.target = cameraRef.current;
        scene.add(vrm.scene);
        vrmRef.current = vrm;

        const vhh = new VRMHumanoidHelper(vrm.humanoid);
        helperRoot.add(vhh);

        const ik = new IK();
        ik.add(createDummyChain(scene, vrm, ikLeftObj, "L"));
        ik.add(createDummyChain(scene, vrm, ikRightObj, "R"));
        ikRef.current = ik;

        scene.add(new IKHelper(ik));
      },
      (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
      (error) => console.error(error),
    );
  }, []);

  useEffect(() => {
    const animate = () => {
      if (ocRef.current) {
        ocRef.current.update();
      }
      if (ikRef.current) {
        ikRef.current.solve();
        applyDummyToRealBones(dummyBoneMap);
      }
      if (vrmRef.current && clockRef.current){
        vrmRef.current.update(clockRef.current.getDelta());
      }
      requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        labelRendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
  }, []);

  useEffect(() => {
    ikLeftTarget.current.position.set(handL.x, handL.y, handL.z);
    if (labelLRef.current) labelLRef.current.textContent = handL.x + "," + handL.y + "," + handL.z;
  }, [handL]);
  useEffect(() => {
    ikRightTarget.current.position.set(handR.x, handR.y, handR.z);
    if (labelRRef.current) labelRRef.current.textContent = handR.x + "," + handR.y + "," + handR.z;
  }, [handR]);
  useEffect(() => {
    if (vrmRef.current) {
      lookAtTarget.current. position.set(head.x, head.y, head.z);
      const headNode = vrmRef.current.humanoid.getRawBoneNode(VRMHumanBoneName.Head);
      // 棒立ちならこれでいいけど…
      const headPos = new THREE.Vector3();
      headNode.getWorldPosition(headPos);
      const correctPos = new THREE.Vector3(headPos.x - head.x, 2*headPos.y - head.y, headPos.z - head.z);
      headNode.lookAt(correctPos);
    }
  }, [head]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', background:'#aaaaaa' }}/>
  );
};

export default Avatar;

