import * as d3 from 'd3';
import { Col, Layout, Row, Spin, Select, Typography } from "antd";
import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import { dataConfigs } from './config.js';
import DRView from './components/DRPlot.js';
import MetricView from './components/MetricView.js';
import HeatmapView from './components/HeatmapView.js';
import TimelineView from './components/TimelineView.js';

const { Header, Content } = Layout;
const { Option } = Select;
const { Text } = Typography;

function App() {
  const [files, setFiles] = useState(Object.keys(dataConfigs));
  const [selectedFile, setSelectedFile] = useState(dataConfigs.file);
  const [headerFile, setHeaderFile] = useState(dataConfigs.headerFile);
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
  const [metricData, setMetricData] = useState(null);
  const [zScores, setzScores] = useState(null);
  const [baselines, setBaselines] = useState(null);
  const [error, setError] = useState(null);
  const [headers, setHeaders] = useState(null);
  const [recompute, setRecompute] = useState(0);
  const [nodeClusterMap, setNodeClusterMap] = useState(new Map());

  const totalNodes = DRTData?.length || 0;
  const totalMeasures = nodeData?.columns.length || 0;

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

  const getCsvData = async () => {
    const [data, headers] = await Promise.all([
      d3.csv(process.env.PUBLIC_URL + "/data/" + selectedFile, d3.autoType),
      fetch(process.env.PUBLIC_URL + "/data/" + headerFile).then(r => r.json())
    ]);
    const proc = {};
    const selectedNodes = new Set(selectedPoints);
    for (const key of selectedDims) proc[key] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const node = row.nodeId;
      if (selectedNodes.has(node)) {
        for (const key of selectedDims) {
          proc[key].push({
            timestamp: new Date(row.timestamp),
            nodeId: row.nodeId,
            value: row[key],
          });
        }
      }
    }

    setMetricData(proc);
    setNodeData(data);
    setHeaders(headers);
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

  useEffect(() => {
    async function init() {
      try {
        await getCsvData();
        await getDRTimeData();
        await getMrDMD();
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    }

    init();
  }, []);

  return (
    <Layout style={{ height: "100vh", padding: "5px" }}>
      <Header style={{ background: "#fff", padding: "0 10px", marginBottom: "2px" }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Row align="middle" gutter={8}>
              <Col>
                <Typography.Title level={1} style={{ margin: 0, fontSize: "25px", paddingRight: '20px' }}>
                  Cluster-Based MVTS Analysis
                </Typography.Title>
              </Col>
              <Col>
                File: 
              </Col>
              <Col>
                <Select
                  style={{ width: 230 }}
                  value={selectedFile}
                  onChange={(value) => handleFileChange(value)}                  
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
                <TimelineView 
                    bStart={bStart}
                    bEnd={bEnd}
                    nodeData={nodeData}
                    nodeDataStart={new Date(nodeData[0]?.timestamp)}
                    nodeDataEnd={new Date(nodeData[nodeData?.length - 1]?.timestamp)}
                    nodeClusterMap={nodeClusterMap}
                  />
                  )}
                {((!metricData) || (!baselines) || (!zScores) || (!headers)) ? (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <MetricView 
                    data={metricData} 
                    timeRange={[new Date(bStart), new Date(bEnd)]}
                    selectedDims={selectedDims}
                    selectedPoints={selectedPoints}
                    fcs={FCs}
                    setSelectedDims={setSelectedDims}
                    baselines={baselines}
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
                    <HeatmapView 
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
