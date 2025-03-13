import React, { useState, useEffect, useRef } from 'react';
import { getColor, colorScale, colorScheme } from '../utils/colors.js';
import * as d3 from 'd3';

const Matrix = ({ data, FCs }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 400, height: 400 });
    
    useEffect(() => {
      if (!svgContainerRef.current || !FCs || !data) return; 
      
        const margin = { top: 30, right: 80, bottom: 50, left: 50 };
        const width = size.width;
        const height = size.height;

        const agg_feat_contrib_mat = FCs.agg_feat_contrib_mat
        const label_to_rep_row = FCs.label_to_rep_row
        const label_to_rows = FCs.label_to_rows

        const numRows = agg_feat_contrib_mat.length; // features
        const numCols = agg_feat_contrib_mat[0].length; // clusters

        const excludeFeatures = ["Cluster", "nodeId", "PC1", "PC2", "UMAP1", "UMAP2", "tSNE1", "tSNE2"]
        const xlabel_names = FCs.order_col;
        const ylabel_names = Object.keys(data[0]).filter(
            key => !excludeFeatures.includes(key)
        );

        const xScale = d3.scaleBand()
            .domain(d3.range(numCols))
            .range([margin.left, width/2])
            .padding(0.05);

        const yScale = d3.scaleBand()
            .domain(d3.range(numRows))
            .range([0, height-margin.bottom])
            .padding(0.05);

        const contributionScale = d3.scaleSequential(d3.interpolateRdBu) 
            .domain([d3.max(agg_feat_contrib_mat.flat()), d3.min(agg_feat_contrib_mat.flat())]);

        const svg = d3.select(svgContainerRef.current)
            .append("svg")
            .attr('id', `matrix-svg`)
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${size.width} ${size.height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        svg.selectAll()
            .data(agg_feat_contrib_mat.flatMap((row, i) => row.map((val, j) => ({ row: i, col: j, value: val }))))
            .enter().append("rect")
            .attr("x", d => xScale(d.col))
            .attr("y", d => yScale(d.row))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .style("fill", d => contributionScale(d.value))
            .style("stroke", "white")
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .style("opacity", 0.6)
                    .style('cursor', 'pointer')
            })
            .on("mouseout", function (event, d) {
                d3.select(this)
                    .style("opacity", 1)
                    .style('cursor', 'default')
                    
            });


        // Cluster colors
        const clusterColors = xlabel_names.map((_, i) => colorScale(_));
        const clusterGroup = svg.append("g")
            .attr("transform", `translate(0, ${height + 10})`) 
            .selectAll("g")
            .data(clusterColors)
            .enter()
            .append("g")
            .attr("transform", (d, i) => `translate(${xScale(i) - 40}, 0)`);

        clusterGroup.each(function(d, i) {
            d3.select(this)
                .append("rect")
                .attr("width", 10)
                .attr("height", 10)
                .style("fill", d)
                .attr("transform", "rotate(-45)"); // Rotate square to match label rotation
        });

        // X labels (Cluster IDs)
        svg.append("g")
            .attr("transform", `translate(0, ${height - margin.bottom})`) // Position labels at the bottom of the matrix
            .call(d3.axisBottom(xScale).tickFormat((d, i) => 'Cluster ' + xlabel_names[i]))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-0.5em")
            .attr("dy", "0.15em")
            .attr("transform", "rotate(-45)") // Rotate the labels
            .style("font-size", "14px");
        
        // Feature names (y labels)
        svg.append("g")
            .attr("transform", `translate(${width/2}, 0)`)
            .call(d3.axisRight(yScale).tickFormat((d, i) => ylabel_names[i]))
            .selectAll("text")
            .style("font-size", "14px");

        const title = "Feature Contributions";
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", -10) 
            .attr("text-anchor", "middle") 
            .style("font-size", "14px") 
            .style("font-weight", "bold") 
            .text(title);
      
      }, [FCs]);
    
      return <div ref={svgContainerRef} style={{ width: '100%', height: '400px' }}></div>;

};
    
export default Matrix;