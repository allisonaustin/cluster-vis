import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Typography, Card, Spin } from "antd";
import './App.css';
import FeatureView from './components/FeatureView.js';
import Coordinates from './components/CoordinateView.js';
import DR from './components/DRView.js';
import TimelineView from './components/TimelineView.js';

const { Header, Content } = Layout;

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [FCs, setFCs] = useState(null);
  const [DRTData, setDRTData] = useState(null);
  const [mgrData, setMgrData] = useState(null);
  const [perfData, setPerfData] = useState([]);
  const [triggerData, setTriggerData] = useState([]);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState('mgr/novadaq-far-mgr-01-full.json');
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedDims, setSelectedDims] = useState(['bytes_out', 'cpu_speed', 'cpu_system', 'Missed Buffers_P1', 'proc_run', 'proc_total']);


  useEffect(() => {
    Promise.all([getDRTimeData(), 
                // getDRFeatureData(),
                getMgrData(selectedFile)
              ])
      .then(() => console.log("Data fetched successfully"))
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

  const getDRTimeData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/drTimeData`);
      const data = await response.json();
      
      if (response.ok) {
        setDRTData(data.dr_features);
        setFCs(data.feat_contributions);
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

  const getBufferData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/drTimeData`);
      const data = await response.json();
      
      if (response.ok) {
        setDRTData(data.dr_features);
        setFCs(data.feat_contributions);
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

  const getMgrData = async (filePath) => {
    if (!filePath) return;
    try {
      const response = await fetch(`http://127.0.0.1:5010/mgrData`);
      const data = await response.json();
      if (response.ok) {
        setMgrData(data);  
        setError(null); 
        const trigFilt = Object.keys(data)
          .filter((key) => (
              key.includes('P1') &&
              (key.includes('Data Driven') || (key.includes('Trigger'))) &&
              !key.includes('Activity') &&
              !key.includes('prescale')
            ))
          .reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
          }, {});

      // Filter data for performance (keys not containing 'P1')
      const perfFilt = Object.keys(data)
        .filter((key) => !key.includes('P1'))
        .reduce((obj, key) => {
          obj[key] = data[key];
          return obj;
        }, {});

      setTriggerData(trigFilt);
      setPerfData(perfFilt);
      } else {
        setMgrData(null);  
        setTriggerData(null);   
        setPerfData(null);   
        setError("Failed to fetch data. Please check that the server is running.");
      }
    } catch (error) {
      setMgrData(null);    
      setTriggerData(null);
      setPerfData(null);
      setError("Failed to fetch data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const onFileChange = (newFile) => {
    setSelectedFile(newFile); 
    getMgrData(newFile);
  };


  return (
    <Layout style={{ height: "100vh", padding: "10px" }}>
      <Content style={{ marginTop: "10px" }}>
        {(!DRTData || !perfData) ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
            <Spin size="large" />
          </div>
        ) : (
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <TimelineView 
                  mgrData={mgrData} 
                />
              <Card title="FEATURE VIEW" size="small" style={{ height: "auto", maxHeight: '500px', overflow:'auto' }}>
              {Object.keys(perfData).filter(field => selectedDims.includes(field)).map((field, index) => (                  
                <FeatureView 
                  key={field} 
                  data={perfData} 
                  field={field} 
                  index={index} 
                />
              ))}
            </Card>
            </Col>
            <Col span={12}>
                <DR 
                  data={DRTData} 
                  fcs={FCs}
                  type="time" 
                  setSelectedPoints={setSelectedPoints} 
                  selectedPoints={selectedPoints} 
                  hoveredPoint={hoveredPoint} 
                  setHoveredPoint={setHoveredPoint} 
                />
                <Coordinates 
                  data={DRTData} 
                  selectedPoints={selectedPoints} 
                  setSelectedPoints={setSelectedPoints} 
                  hoveredPoint={hoveredPoint} 
                  setHoveredPoint={setHoveredPoint}
                  selectedDims={selectedDims}
                  setSelectedDims={setSelectedDims}
                />
              </Col>
          </Row>
        )}
      </Content>
    </Layout>
  );
}

export default App;
