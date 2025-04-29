import { Col, Layout, Row, Spin } from "antd";
import React, { useEffect, useState } from 'react';
import './App.css';
import DR from './components/DRPlot.js';
import FeatureView from './components/FeatureView.js';
import MRDMD from './components/MrDMDView.js';
import NodeStatusView from './components/NodeStatusView.js';

const { Header, Content } = Layout;

function App() {
  const [FCs, setFCs] = useState(null);
  const [DRTData, setDRTData] = useState(null);
  const [nodeData, setNodeData] = useState(null);
  const [zScores, setzScores] = useState(null);
  const [baselines, setBaselines] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPoints, setSelectedPoints] = useState(["novadaq-far-farm-06", "novadaq-far-farm-07","novadaq-far-farm-08", "novadaq-far-farm-09","novadaq-far-farm-10","novadaq-far-farm-12","novadaq-far-farm-130","novadaq-far-farm-131", "novadaq-far-farm-133","novadaq-far-farm-142","novadaq-far-farm-150", "novadaq-far-farm-16","novadaq-far-farm-164", "novadaq-far-farm-170","novadaq-far-farm-180","novadaq-far-farm-181","novadaq-far-farm-184", "novadaq-far-farm-189", "novadaq-far-farm-20","novadaq-far-farm-28", "novadaq-far-farm-35","novadaq-far-farm-59","novadaq-far-farm-61","novadaq-far-farm-78","novadaq-far-farm-92"]);
  const [selectedDims, setSelectedDims] = useState(['cpu_idle', 'bytes_out', 'cpu_system', 'proc_run', 'proc_total', 'cpu_nice']);
  const [bStart, setBStart] = useState('2024-02-21 14:47:30Z')
  const [bEnd, setBEnd] = useState('2024-02-21 22:00:00Z')
  const [recompute, setRecompute] = useState(1)
  const [baselineEdit, setBaselineEdit] = useState(false);
  const [nodeClusterMap, setNodeClusterMap] = useState(new Map());
  
  
  useEffect(() => {
    Promise.all([ 
        getNodeData(selectedDims),
        getDRTimeData()
      ])
      .then(() => {
        console.log("Data fetched successfully");
        getMrDMD();
      })
      .catch((err) => console.error("Error fetching data:", err));
  }, []); // TODO: dependency on [selectedDims]

  const getNodeData = async (selectedCols) => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/nodeData/${selectedCols}`);
      const data = await response.json();
      if (response.ok) { 
        setNodeData(data)
      } else {
        setNodeData(null);   
        setError("Failed to fetch data. Please check that the server is running.");
      }
    } catch (error) {
      setNodeData(null)
      setError("Failed to fetch data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const getDRTimeData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/drTimeData`);
      const data = await response.json();
      
      if (response.ok) {
        setDRTData(data.dr_features);
        setFCs(data.feat_contributions);
        const clusters = new Map();
        data.dr_features.forEach(d => {
            clusters.set(d.nodeId, d.Cluster);
        });
        setNodeClusterMap(clusters);  
        setError(null); 
      } else {
        setDRTData(null);  
        setError("Failed to fetch DR data. Please check that the server is running.");
      }

    } catch (error) {
      setDRTData(null);    
      setError("Failed to fetch DR data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const getMrDMD = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/mrdmd/${selectedPoints}/${selectedDims}/${recompute}/0/0/0/0/0`);
      const data = await response.json();
      if (response.ok) { 
        setzScores(data.zscores)
        setBaselines(data.baselines)
      } else {
        setzScores(null);   
        setBaselines(null)
        setError("Failed to fetch data. Please check that the server is running.");
      }
    } catch (error) {
      setzScores(null)
      setBaselines(null)
      setError("Failed to fetch data. Please check that the server is running.");
      console.error(error);     
    }
  };
  
  return (
    <Layout style={{ height: "100vh", padding: "10px" }}>
      <Content style={{ marginTop: "10px" }}>
          <Row gutter={[8, 8]}>
            <Col span={14}>
              {((!nodeData) || (!DRTData)) ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                <NodeStatusView 
                    bStart={bStart}
                    bEnd={bEnd}
                    nodeData={nodeData}
                    nodeDataStart={new Date(nodeData?.data[0]?.timestamp)}
                    nodeDataEnd={new Date(nodeData?.data[nodeData?.data.length - 1]?.timestamp)}
                    nodeClusterMap={nodeClusterMap}
                  />
                  )}
                {((!nodeData) || (!baselines) || (!DRTData) || (!zScores)) ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <FeatureView 
                    data={nodeData} 
                    timeRange={[new Date(bStart), new Date(bEnd)]}
                    selectedDims={selectedDims}
                    selectedPoints={selectedPoints}
                    fcs={FCs}
                    setSelectedDims={setSelectedDims}
                    baselines={baselines}
                    setBaselineEdit={setBaselineEdit}
                    zScores={zScores}
                    setzScores={setzScores}
                    setBaselines={setBaselines}
                    nodeClusterMap={nodeClusterMap}
                  />
              )}
            </Col>
              <Col span={10}>
                {((!DRTData) || (!FCs)) ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <div>
                      <DR 
                        data={DRTData} 
                        type="time" 
                        setSelectedPoints={setSelectedPoints} 
                        selectedPoints={selectedPoints} 
                        selectedDims={selectedDims}
                        setzScores={setzScores}
                        setBaselines={setBaselines}
                      />
                  </div>
                  )}
                  {(!zScores) ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                      <Spin size="large" />
                    </div> ) : (
                    <MRDMD 
                      data={zScores} 
                  />
                  )}
              </Col>
          </Row>
      </Content>
    </Layout>
  );
}

export default App;
