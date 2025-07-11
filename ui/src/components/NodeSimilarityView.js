import { Card, Col, Form, Row, Select, Slider } from "antd";
import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { colorScale } from '../utils/colors.js';
import LassoSelection from '../utils/lasso.js';
import Tooltip from '../utils/tooltip.js';

const { Option } = Select;

const NodeSimilarityView = ({ data, type, setSelectedPoints, selectedPoints, selectedDims, setzScores, setBaselines, nodeClusterMap, updateClustersCallback }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 300, height: 300});
    const [margin, setMargin] = useState({ top: 10, right: 20, bottom: 20, left: 20 });
    const [method1, setMethod1] = useState("PC");
    const [method2, setMethod2] = useState("UMAP");
    const [nNeighbors, setNNeighbors] = useState(50);
    const [minDist, setMinDist] = useState(0.5);
    const [numClusters, setNumClusters] = useState(4);
    const [highlight, setHighlight] = useState(1);
    const [nonHighlight, setNonHighlight] = useState(0.2);
    const [tooltip, setTooltip] = useState({
              visible: false,
              content: '',
              x: 0,
              y: 0
          });

    function getIdVal(d) {
        return (type === 'feature') ? d.Measurement : d.nodeId;
      }

    useEffect(() => {
        if (!svgContainerRef.current || !data ) return;

        // NOTE: this currently does nothing as 1) setSize() runs after this useEffect() runs,
        //       and 2) this useEffect() does not depend on Size. 
        // const { w, h } = svgContainerRef.current.getBoundingClientRect();
        // setSize({ w, h });
        
        const width = size.width;
        const height = size.height;

        const xKey = method2 + '1';
        const yKey = method2 + '2';

        const xScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d[xKey]) - 1, d3.max(data, d => +d[xKey]) + 1])
            .range([0, width - margin.right]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d[yKey]) - 1, d3.max(data, d => +d[yKey]) + 1])
            .range([height - margin.bottom, margin.top]);
        
        const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `dr-chart-svg-${type}`)
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");

          const zoomLayer = svg.append("g")
          .attr("class", "zoom-layer");

        let circs = zoomLayer.selectAll(".dr-circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", (d, i) => "dr-circle")
            .attr('id', d => getIdVal(d))
            .attr("cx", d => xScale(d[xKey]))
            .attr("cy", d => yScale(d[yKey]))
            .attr('stroke','black')
            .attr('stroke-width', '1px')
            .attr("r", 4)
            // .style('fill', d => colorScale(nodeClusterMap.get(d.nodeId)))
            .style('fill', d3.schemeObservable10[0])
            .style("opacity", d => {
                return selectedPoints.includes(d.nodeId) ? highlight : nonHighlight;
            })
            .attr("_prevOpacity", d => {
                return selectedPoints.includes(d.nodeId) ? highlight : nonHighlight;
            })
            .on("mouseover", function (event, d) {
                let circle = d3.select(this)

                circle.attr("_prevOpacity", circle.style("opacity"));

                circle
                    .transition()
                    .duration(150)
                    .attr("r", 8)
                    .style("opacity", highlight)

                // highlighting mrdmd cell 
                d3.selectAll(`.node-${d.nodeId}`)
                    .transition()
                    .duration(150)
                    .style("stroke", "black")
                    .style("stroke-width", 2);

                // highlighting time series
                let lines = d3.selectAll(".line-svg").selectAll("path.line");
                lines.each(function(lineData) {
                    if (lineData[0] === d.nodeId) {
                        d3.select(this)
                            .transition()
                            .duration(150)
                            .style("opacity", 1)
                    } else {
                        d3.select(this)
                            .transition()
                            .duration(150)
                            .style("opacity", 0.1); 
                    }
                });

                setTooltip({
                    visible: true,
                    content: d.nodeId,
                    x: event.clientX,
                    y: event.clientY,
                });
            })
            .on("mouseout", function (event, d) {
                let circle = d3.select(this)

                let prevOpacity = circle.attr("_prevOpacity") || nonHighlight; 
                circle.transition()
                    .duration(150)
                    .attr("r", 4)
                    .style("opacity", prevOpacity);

                d3.selectAll(`.node-${d.nodeId}`)
                    .transition()
                    .duration(150)
                    .style("stroke", "none") // Remove border
                    .style("stroke-width", 0);

                let lines = d3.selectAll(".line-svg").selectAll("path.line");

                // Resetting all line styles
                lines.transition()
                    .duration(150)
                    .style("stroke-width", 1)
                    .style("opacity", highlight)

                setTooltip(prev => ({
                    ...prev,
                    visible: false,
                }));
            })
            .style('opacity', 0);

            circs
                .transition()
                .duration(800)
                .style("opacity", d => {
                    const idVal = getIdVal(d);
                    return selectedPoints.includes(idVal) ? highlight : nonHighlight;
                })

            svg.node().xScale = xScale;
            svg.node().yScale = yScale;

            const zoom = d3.zoom()
            .scaleExtent([0.5, 10])
            .filter(event => event.type === "wheel")   
            .on("zoom", (event) => {
              zoomLayer.attr("transform", event.transform);
            });
        
            svg.call(zoom);
    
        return () => {
            svg.remove();
        };
        
    }, [type]);

    // scatter plot update
    useEffect(() => {
        if (!data || data.length === 0 || !svgContainerRef.current) return;

        const svg = d3.select(svgContainerRef.current).select("svg");
        const xKey = method2 + '1';
        const yKey = method2 + '2';

        // const xScale = svg.node()?.xScale;
        // const yScale = svg.node()?.yScale;
        // if (!xScale || !yScale) return;

        // recalculating bounds with padding
        const xExtent = d3.extent(data, d => +d[xKey]);
        const yExtent = d3.extent(data, d => +d[yKey]);

        const xScale = d3.scaleLinear()
            .domain([xExtent[0], xExtent[1]])
            .range([0, size.width - margin.right]);

        const yScale = d3.scaleLinear()
            .domain([yExtent[0], yExtent[1]])
            .range([size.height - margin.bottom, margin.top]);

        // Store updated scales on SVG
        svg.node().xScale = xScale;
        svg.node().yScale = yScale;

        // animating existing points to new positions
        svg.selectAll(".dr-circle")
            .data(data, d => getIdVal(d))  
            .transition()
            .duration(1000)
            .attr("cx", d => xScale(+d[xKey]))
            .attr("cy", d => yScale(+d[yKey]));

    }, [data]);

    useEffect(() => {
        d3.select(".zoom-layer").selectAll(".dr-circle")
            // .style('fill', d => colorScale(nodeClusterMap.get(d.nodeId)))
            .style('fill', d3.schemeObservable10[0])
    }, [nodeClusterMap]);

    useEffect(() => {
        d3.select(svgContainerRef.current)
            .selectAll(".dr-circle")
            .transition()
            .duration(300)
            .style("opacity", d => {
                const idVal = getIdVal(d);
                if (selectedPoints.includes(idVal) || selectedPoints.length === 0) {
                    return highlight;
                } else {
                    return nonHighlight;
                }
            });
    }, [selectedPoints]);

    // updates values of points based on new DR method
    const updateChart = (method1, method2) => {
        const chart = d3.select(svgContainerRef.current).select("svg");
        setMethod1(method1)
        setMethod2(method2)

        const xKey = method2 + '1';
        const yKey = method2 + '2';

        const xScale = chart.node()?.xScale;
        const yScale = chart.node()?.yScale;

        xScale.domain([d3.min(data, d => +d[xKey]) - 1, d3.max(data, d => +d[xKey]) + 1])
        yScale.domain([d3.min(data, d => +d[yKey]) - 1, d3.max(data, d => +d[yKey]) + 1])

        chart.select("#x-axis-label-dr")
            .text(xKey);

        chart.select("#y-axis-label-dr")
            .text(yKey);

        const t = d3.transition()
            .duration(400) 
            .ease(d3.easeCubicInOut);
        
        chart.select('.x-axis').call(d3.axisBottom(xScale));
        chart.select('.y-axis').transition(t).call(d3.axisLeft(yScale)).selectAll('text').style('font-size', '16px');

        chart.selectAll(".dr-circle")
            .data(data)
            .join("circle")  
            .transition()
            .duration(1000)
            .attr("cx", d => xScale(+d[xKey]))
            .attr("cy", d => yScale(+d[yKey]))
    }

    // Lasso selection
    const handleSelection = (selected) => {
        const chart = d3.select(svgContainerRef.current).select("svg");
        
        setSelectedPoints(selected)
        
        chart.selectAll('.dr-circle')
            .style("opacity", d => {
                const idVal = getIdVal(d);
                if (selected.includes(idVal) || selected.length == 0) {
                    return highlight; 
                } else {
                    return nonHighlight;
                }
        });

        if (selected.length) {
             // running mrdmd on new nodes with recomputed baselines
            fetch(`http://127.0.0.1:5010/mrdmd/${selected}/${selectedDims}/1/0/0/0/0/0`)
                .then(response => response.json())
                .then(dmdData => {
                    setzScores(dmdData.zscores) // updating zscores
                    setBaselines(dmdData.baselines) // updating baselines
                })
        }
    };

    const handleUMAPUpdate = (n_neighbors, min_dist) => {
        setNNeighbors(n_neighbors);
        setMinDist(min_dist);
        updateClustersCallback(numClusters, n_neighbors, min_dist, true);
    }

    const handleSubmitNKMeans = values => {
        updateClustersCallback(values.numClusters, nNeighbors, minDist)
    };
    const clusterOptions = Array.from({ length: 19 }, (_, i) => i + 2); // [2..20]

    return (
    <>
        <Card 
            title="NODE SIMILARITY VIEW" 
            size="small" 
            style={{ height:'auto' }}
        >
            <Row>
                <Col span={24}>
                    <div style={{ display: "flex", height: '300px', flexDirection: "row", gap: "20px" }}>
                        <div ref={svgContainerRef} style={{ width: '380px' }}></div>

                        <LassoSelection svgRef={svgContainerRef} targetItems={".dr-circle"} onSelect={handleSelection} />

                        <div id="form-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                             {/* UMAP Settings */}
                            <div style={{ display: "flex", flexDirection: "column", gap: '5px'}}>
                                <p style={{ margin: 0, fontWeight: "bold" }}>UMAP Parameters:</p>
                                <Form layout="horizontal">
                                    <Form.Item label="n_neighbors" style={{ marginBottom: 0 }}>
                                        <Slider
                                            min={3}
                                            max={100}
                                            step={1}
                                            defaultValue={50}
                                            style={{ width: 100 }}
                                            onChangeComplete={(val) => handleUMAPUpdate(val, minDist)}
                                        />
                                    </Form.Item>
                                    <Form.Item 
                                        label="min_dist">
                                        <Slider
                                            min={0.0}
                                            max={1.0}
                                            step={0.05}
                                            defaultValue={0.5}
                                            style={{ width: 100 }}
                                            onChangeComplete={(val) => handleUMAPUpdate(nNeighbors, val)}
                                        />
                                    </Form.Item>
                                </Form>
                            </div>
                             {/* k-means Settings */}
                            {/* <div style={{ display: "flex", flexDirection: "column" }}>
                                <p style={{ margin: 0, fontWeight: "bold" }}>K-Means:</p>
                                <Form onFinish={handleSubmitNKMeans} initialValues={{ numClusters: 4 }}>
                                    <Form.Item name="numClusters" label="Num clusters">
                                        <Select
                                        style={{ width: 60 }}
                                        onChange={(value) => {
                                            handleSubmitNKMeans({ numClusters: value });
                                        }}
                                        >
                                            {clusterOptions.map((num) => (
                                                <Option key={num} value={num}>
                                                {num}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Form>
                            </div> */}
                        </div>
                    </div>
                </Col>
            </Row>
        </Card>
        <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
            tooltipId={'dr-tooltip'}
        />
    </>
    );

}

export default NodeSimilarityView;