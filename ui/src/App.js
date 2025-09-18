import { Col, Layout, Row, Spin, Select, Typography } from "antd";
import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import { dataConfigs } from './config.js';
import DRView from './components/DRPlot.js';
import MetricView from './components/MetricView.js';
import MRDMDView from './components/MrDMDView.js';
import NodeStatusView from './components/NodeStatusView.js';

const { Header, Content } = Layout;
const { Option } = Select;
const { Text } = Typography;

function App() {
  const [files, setFiles] = useState(Object.keys(dataConfigs));
  const [selectedFile, setSelectedFile] = useState('ganglia_2024-02-21.csv'); // env_logs_2018-06-09.csv, ganglia_2024-02-21.csv

  const defaults = dataConfigs[selectedFile] || {};
  const [selectedPoints, setSelectedPoints] = useState(defaults.selectedPoints || []);
  const [selectedDims, setSelectedDims] = useState(defaults.selectedDims || []);
  const [bStart, setBStart] = useState(defaults.bStart || "");
  const [bEnd, setBEnd] = useState(defaults.bEnd || "");
  const [nNeighbors, setNNeighbors] = useState(defaults.nNeighbors || 50);
  const [minDist, setMinDist] = useState(defaults.minDist || 0.3);
  const [numClusters, setNumClusters] = useState(defaults.numClusters || 4);

  const [FCs, setFCs] = useState(null);
  const [DRTData, setDRTData] = useState(null);
  const [nodeData, setNodeData] = useState(null);
  const [zScores, setzScores] = useState(null);
  const [baselines, setBaselines] = useState(null);
  const [error, setError] = useState(null);
  const [dataOptions, setDataOptions] = useState([]);
  const [headers, setHeaders] = useState(null);
  const [recompute, setRecompute] = useState(0);
  const [baselineEdit, setBaselineEdit] = useState(false);
  const [nodeClusterMap, setNodeClusterMap] = useState(new Map());

  const totalNodes = DRTData?.length || 0;
  const totalMeasures = nodeData?.features.length || 0;

  useEffect(() => {
    getNodeData(selectedDims)
      .then(() => {
        return Promise.all([
          getDRTimeData(),
          getHeaders()
        ]);
      })
      .then(() => {
        console.log("Data fetched successfully");
        getMrDMD();
      })
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

   const handleFileChange = (newFile) => {
    setSelectedFile(newFile);
    const defaults = dataConfigs[newFile] || {};
    setSelectedPoints(defaults.selectedPoints || []);
    setSelectedDims(defaults.selectedDims || []);
    setBStart(defaults.bStart || "");
    setBEnd(defaults.bEnd || "");
    setNNeighbors(defaults.nNeighbors || 50);
    setMinDist(defaults.minDist || 0.3);
  };

  const updateClustersCallback = useCallback(async (numClusters, nNeighbors, minDist, forceRecompute) => {
    const params = new URLSearchParams();
    params.append('numClusters', numClusters);
    if (nNeighbors !== null) params.append('n_neighbors', nNeighbors);
    if (minDist !== null) params.append('min_dist', minDist);
    
    try {
      const response = await fetch(`http://127.0.0.1:5010/recomputeClusters/${numClusters}/${nNeighbors || 0}/${minDist || 0}/${forceRecompute ? 1 : 0}`);
      if (response.ok) {
        const data = await response.json();
        const clusters = new Map();
        data.node_cluster_map.forEach(d => {
            clusters.set(d.nodeId, d.Cluster);
        });
        setNodeClusterMap(clusters);
        setDRTData(data.dr_features); // TODO: update scatter plot with new points
        setFCs(data.feat_contributions);
      } else {
        console.error("Failed to fetch new cluster IDs -", response.status, response.statusText);
      }
    } catch (e) {
      console.error("Failed to fetch new cluster IDs -", e);
    }
  }, []);    

  const getNodeData = async (selectedCols) => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/nodeData/${selectedCols}/${selectedFile}`);
      if (response.ok) { 
        const data = await response.json();
        setNodeData(data)
      } else {
        setNodeData(null);
        setError("Failed to fetch data. Please check that the server is running.");
      }
    } catch (error) {
      setNodeData(null);
      setError("Failed to fetch data. Please check that the server is running.");
      console.error(error);
    }
  };

  const getDRTimeData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/drTimeData/${nNeighbors}/${minDist}/${numClusters}`);
      
      if (response.ok) {
        const data = await response.json();
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
      if (response.ok) { 
        const data = await response.json();
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

  const getHeaders = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/headers`);
      const data = await response.json();
      if (response.ok) { 
        setHeaders(data);
      } else {
        setHeaders([]);
        setError("Failed to fetch headers. Please check that the server is running.");
      }
    } catch (error) {
      setHeaders([]);
      setError("Failed to fetch headers. Please check that the server is running.");
      console.error(error);
    }
  };

  return (
    <Layout style={{ height: "100vh", padding: "5px" }}>
      <Header style={{ background: "#fff", padding: "0 10px", marginBottom: "2px" }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Row align="middle" gutter={8}>
              <Col>
                <Typography.Title level={1} style={{ margin: 0, fontSize: "30px", paddingRight: '20px' }}>
                  Node Cluster Analysis
                </Typography.Title>
              </Col>
              <Col>
                File: 
              </Col>
              <Col>
                <Select
                  style={{ width: 230 }}
                  value={selectedFile}
                  onChange={(e) => handleFileChange(e.target.value)}
                  placeholder="Select file"
                >
                  {files.map((f) => (
                    <Option key={f} value={f}>
                      {f}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </Col>

          <Col>
            <Row gutter={24}>
              <Col>
                <Text strong italic style={{ fontSize: "18px" }}>
                  Nodes: {totalNodes}
                </Text>
              </Col>
              <Col>
                <Text strong italic style={{ fontSize: "18px" }}>
                  Metrics: {totalMeasures}
                </Text>
              </Col>
            </Row>
          </Col>
        </Row>
      </Header>
      <Content style={{ marginTop: "5px" }}>
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
                {((!nodeData) || (!baselines) || (!DRTData) || (!zScores) || (!headers)) ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <MetricView 
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
                    headers={headers}
                    selectedFile={selectedFile}
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
                      <DRView 
                        data={DRTData} 
                        type="time" 
                        setSelectedPoints={setSelectedPoints} 
                        selectedPoints={selectedPoints} 
                        selectedDims={selectedDims}
                        setzScores={setzScores}
                        setBaselines={setBaselines}
                        nodeClusterMap={nodeClusterMap}
                        updateClustersCallback={updateClustersCallback}
                        nNeighbors={nNeighbors}
                        setNNeighbors={setNNeighbors}
                        minDist={minDist}
                        setMinDist={setMinDist}
                        numClusters={numClusters}
                        setNumClusters={setNumClusters}
                      />
                  </div>
                  )}
                  {(!zScores) ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                      <Spin size="large" />
                    </div> ) : (
                    <MRDMDView 
                      data={zScores} 
                      nodeClusterMap={nodeClusterMap}
                  />
                  )}
              </Col>
          </Row>
      </Content>
    </Layout>
  );
}

export default App;
