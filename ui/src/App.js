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
  const [selectedPoints, setSelectedPoints] = useState(['c0-0c0s6n0','c0-0c0s6n1','c0-0c0s7n0','c0-0c0s7n1','c0-0c0s15n0','c0-0c0s15n1','c0-0c1s0n0','c0-0c1s0n1','c1-0c0s0n0','c1-0c0s0n1','c1-0c0s1n0','c1-0c0s1n1','c1-0c0s2n0','c1-0c0s2n1','c1-0c0s3n0','c1-0c0s3n1','c1-0c0s4n0','c1-0c0s4n1','c1-0c0s10n0','c1-0c0s10n1','c1-0c0s11n0','c1-0c0s11n1','c2-0c0s5n0','c2-0c0s14n0','c2-0c0s14n1']);
  const [selectedDims, setSelectedDims] = useState(['P_VPP012_POUT', 'P_VCCMP0123_POUT', 'I_VCCMP4567_IOUT', 'I_VPP012_IOUT']);
  const [bStart, setBStart] = useState('2018-06-09 09:00:00Z')
  const [bEnd, setBEnd] = useState('2018-06-09 10:15:00Z')
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
