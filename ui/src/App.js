import { Col, Layout, Row, Spin, Select, Typography } from "antd";
import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import DRView from './components/DRPlot.js';
import MetricView from './components/MetricView.js';
import MRDMDView from './components/MrDMDView.js';
import NodeStatusView from './components/NodeStatusView.js';

const { Header, Content } = Layout;
const { Option } = Select;
const { Text } = Typography;

function App() {
  const [files, setFiles] = useState(['2016-02-06.csv', '2024-02-21.csv', '2024-02-22.csv']);
  const [selectedFile, setSelectedFile] = useState('2024-02-21.csv');
  const [FCs, setFCs] = useState(null);
  const [DRTData, setDRTData] = useState(null);
  const [nodeData, setNodeData] = useState(null);
  const [zScores, setzScores] = useState(null);
  const [baselines, setBaselines] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPoints, setSelectedPoints] = useState(["novadaq-far-farm-06", "novadaq-far-farm-07","novadaq-far-farm-08", "novadaq-far-farm-09","novadaq-far-farm-10","novadaq-far-farm-12","novadaq-far-farm-130","novadaq-far-farm-131", "novadaq-far-farm-133","novadaq-far-farm-142","novadaq-far-farm-150", "novadaq-far-farm-16","novadaq-far-farm-164", "novadaq-far-farm-170","novadaq-far-farm-180","novadaq-far-farm-181","novadaq-far-farm-184", "novadaq-far-farm-189", "novadaq-far-farm-20","novadaq-far-farm-28", "novadaq-far-farm-35","novadaq-far-farm-59","novadaq-far-farm-61","novadaq-far-farm-78","novadaq-far-farm-92"]);
  const [selectedDims, setSelectedDims] = useState(['bytes_out', 'cpu_idle', 'cpu_nice', 'cpu_system', 'proc_run']);
  const [dataOptions, setDataOptions] = useState([]);
  const [headers, setHeaders] = useState(null);
  const [bStart, setBStart] = useState('2024-02-21 14:47:30Z');
  const [bEnd, setBEnd] = useState('2024-02-21 22:00:00Z');
  const [recompute, setRecompute] = useState(1)
  const [baselineEdit, setBaselineEdit] = useState(false);
  const [nodeClusterMap, setNodeClusterMap] = useState(new Map());

  const totalNodes = DRTData?.length || 0;
  const totalMeasures = nodeData?.features.length || 0;
  
  useEffect(() => {
    Promise.all([ 
        getNodeData(selectedDims),
        getDRTimeData(),
        getHeaders()
      ])
      .then(() => {
        console.log("Data fetched successfully");
        getMrDMD();
      })
      .catch((err) => console.error("Error fetching data:", err));
  }, []); // TODO: dependency on [selectedDims]

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
      const response = await fetch(`http://127.0.0.1:5010/nodeData/${selectedCols}`);
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
      const response = await fetch(`http://127.0.0.1:5010/drTimeData`);
      
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
                  style={{ width: 200 }}
                  value={selectedFile}
                  onChange={setSelectedFile}
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
                      />
                  </div>
                  )}
                  {(!zScores) ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                      <Spin size="large" />
                    </div> ) : (
                    <MRDMDView 
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
