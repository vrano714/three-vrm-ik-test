'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const MqttContext = createContext();

export const useMqtt = () => useContext(MqttContext);

export const MqttProvider = ({ children }) => {
  const [positionData, setPositionData] = useState({
    head: { x: 0, y: 1.7, z: -1 }, // 
    handL: { x: 0.75, y: 1.4, z: 0 },
    handR: { x: -0.75, y: 1.4, z: 0 },
    info: "initial"
  });

  // ポーズのパターンを定義
  const poses = [
    {
      head: { x: 1, y: 1.7, z: 1 },
      handL: { x: 0.6, y: 1.8, z: 0 },
      handR: { x: -0.6, y: 0.5, z: 0 },
      info: "pose1"
    },
    {
      head: { x: 0, y: 1.1, z: 1 },
      handL: { x: 0.2, y: 1.0, z: 0 },
      handR: { x: -0.5, y: 1.7, z: 0 },
      info: "pose2"
    },
    {
      head: { x: 0.5, y: 1.7, z: 0.5 },
      handL: { x: 0.2, y: 1.0, z: 0.2 },
      handR: { x: -0.3, y: 1.0, z: -0.3 },
      info: "pose3"
    },
    {
      head: { x: 0.5, y: 2.0, z: 0.5 },
      handL: { x: 0.2, y: 1.5, z: 0.7 },
      handR: { x: -0.2, y: 1.5, z: 0.7 },
      info: "pose4"
    },
  ];

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setPositionData(poses[index]);
      index = (index + 1) % poses.length;
      // console.log(poses[index]);
    }, 2000); // 2秒ごとにポーズを変える

    return () => clearInterval(interval);
  }, []);

  return (
    <MqttContext.Provider value={positionData}>
      {children}
    </MqttContext.Provider>
  );
};