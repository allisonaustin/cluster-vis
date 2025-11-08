import * as d3 from 'd3';
import { Card, Col, Layout, Row, Spin, Select, Typography } from "antd";
import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import './App.css';
import { dataConfigs } from './config.js';
import DRView from './components/DRPlot.js';
import MemoMetricSelect from "./components/MetricSelect.js";
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
  const baselinesRef = useRef({});

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

  const headerMap = useMemo(() => {
    const map = {};
    if (headers) {
      headers.forEach(h => {
        if (h.filename && h.filename.endsWith('.json')) {
          const name = h.filename.replace('.json', '');
          map[name] = h;
        }
      });
    }
    return map;
  }, [headers]);


  function mergeZScores(oldZScores, newZScores, newFeature) {
      let zscoreMap = Object.fromEntries(
          oldZScores.map(entry => [entry.nodeId, { ...entry }])
      );

      newZScores.forEach(entry => {
          const { nodeId, ...newValues } = entry;
          if (zscoreMap[nodeId]) {
              zscoreMap[nodeId] = { 
                  nodeId, 
                  [newFeature]: newValues[newFeature],  
                  ...zscoreMap[nodeId] 
              };
          } else {
              zscoreMap[nodeId] = { nodeId, [newFeature]: newValues[newFeature] };
          }
      });

      return Object.values(zscoreMap);
    }

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
        const initialBaselines = data.baselines.reduce((acc, baseline) => {
        acc[baseline.feature] = {
            baselineX: [
                new Date(baseline.b_start.replace("GMT", "")), 
                new Date(baseline.b_end.replace("GMT", ""))
              ],
              baselineY: [baseline.v_min, baseline.v_max]
            };
            return acc;  
        }, {});
      baselinesRef.current = initialBaselines;
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

  const handleMetricSelectChange = (key) => {
    if (selectedDims.includes(key)) {
      setSelectedDims(prev => prev.filter(dim => dim !== key));

      setMetricData(prev => {
        const newData = { ...prev };
        delete newData[key]; 
        return newData;
      });

      setzScores(prevZ => prevZ.map(z => {
        const { [key]: _, ...rest } = z;
        return rest;
      }));
      return;
    }

    setSelectedDims(prev => [key, ...prev]);

    const selectedNodesSet = new Set(selectedPoints);

    setMetricData(prev => {
      const newData = { ...prev };
      newData[key] = nodeData
        .filter(row => selectedNodesSet.has(row.nodeId))  
        .map(row => ({
          timestamp: new Date(row.timestamp),
          nodeId: row.nodeId,
          value: row[key]
        }));
      return newData;
    });

    // Fetch updated zScores/baselines
    fetch(`http://127.0.0.1:5010/mrdmd/${selectedPoints}/${key}/1/0/0/0/0/0`)
      .then(res => res.json())
      .then(dmdData => {
        setzScores(prev => mergeZScores(prev, dmdData.zscores, key));
        setBaselines(prev => [...dmdData.baselines, ...prev]);
        dmdData.baselines.forEach(baseline => {
          baselinesRef.current[baseline.feature] = {
            baselineX: [
              new Date(baseline.b_start.replace("GMT", "")),
              new Date(baseline.b_end.replace("GMT", ""))
            ],
            baselineY: [baseline.v_min, baseline.v_max]
          };
        });
      });
  };

  // timeBinSize in milliseconds (e.g., 60_000 = 1 min)
  const timeBinSize = 60_000;

  const avgSeriesData = useMemo(() => {
    if (!nodeData?.length || !nodeClusterMap || !headerMap) return {};

    const result = {};
    const clusterSums = {}; // clusterId -> metric -> timestamp -> {sum, count}

    for (const d of nodeData) {
      const clusterId = nodeClusterMap.get(d.nodeId);
      if (clusterId == null) continue;

      for (const metric of Object.keys(headerMap)) {
        const v = d[metric];
        if (v == null || Number.isNaN(v)) continue;

        const t = Math.floor(+new Date(d.timestamp) / timeBinSize) * timeBinSize;

        if (!clusterSums[clusterId]) clusterSums[clusterId] = {};
        if (!clusterSums[clusterId][metric]) clusterSums[clusterId][metric] = {};
        if (!clusterSums[clusterId][metric][t])
          clusterSums[clusterId][metric][t] = { sum: 0, count: 0 };

        const entry = clusterSums[clusterId][metric][t];
        entry.sum += v;
        entry.count += 1;
      }
    }

    // convert to compact arrays
    for (const [clusterId, metrics] of Object.entries(clusterSums)) {
      for (const [metric, tsData] of Object.entries(metrics)) {
        const avgSeries = Object.entries(tsData)
          .map(([t, { sum, count }]) => ({
            timestamp: new Date(+t),
            value: sum / count,
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        if (!result[metric]) result[metric] = {};
        result[metric][+clusterId] = avgSeries;
      }
    }
    console.log(result)
    return result;
  }, [nodeData, nodeClusterMap, headerMap]);

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
                  <Card title="METRIC READING VIEW" size="small" style={{ height: "auto" }}> 
                    <Row gutter={[16, 16]}>
                        <Col span={8}>
                          <MemoMetricSelect 
                            selectedDims={selectedDims}
                            headerMap={headerMap}
                            fcs={FCs} 
                            avgSeriesData={avgSeriesData}
                            onMetricSelectChange={handleMetricSelectChange} />
                      </Col>
                      <Col span={16}>
                        <MetricView 
                            data={metricData} 
                            timeRange={[new Date(bStart), new Date(bEnd)]}
                            selectedDims={selectedDims}
                            selectedPoints={selectedPoints}
                            fcs={FCs}
                            setSelectedDims={setSelectedDims}
                            baselines={baselines}
                            baselinesRef={baselinesRef}
                            zScores={zScores}
                            setzScores={setzScores}
                            setBaselines={setBaselines}
                            nodeClusterMap={nodeClusterMap}
                            headerMap={headerMap}
                            selectedFile={selectedFile}
                          />
                      </Col>
                    </Row>
                  </Card>
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
