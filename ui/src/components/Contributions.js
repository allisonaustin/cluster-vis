import React, { useState, useEffect, useRef } from 'react';
import { getColor, colorScale, colorScheme } from '../utils/colors.js';
import * as d3 from 'd3';

const Contributions = ({ data, FCs }) => {
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
        
        const svg = d3.select(svgContainerRef.current)
            .append("svg")
            .attr('id', `matrix-svg`)
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${size.width} ${size.height + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        var groups = []
        xlabel_names.forEach((cluster, clusterIndex) => {
            const clusterValues = agg_feat_contrib_mat.map(row => row[clusterIndex]);
        
            const filteredData = clusterValues
                .map((value, rowIndex) => ({ value, featureName: ylabel_names[rowIndex], cluster: cluster }))
                .filter(d => d.value < -0.5 || d.value > 0.5);
        
            const group = {
                cluster: cluster,  
                values: filteredData.map(d => d.value),
                features: filteredData.map(d => d.featureName)
            };
        
            groups.push(group);
        });

        const maxContrib = d3.max(agg_feat_contrib_mat.flatMap(row => row));
        const minContrib = d3.min(agg_feat_contrib_mat.flatMap(row => row));

        let groupPadding = 1.5;
        let dataWidth = d3.sum(groups, d=>d.values.length) + (groups.length-1) * groupPadding; 
        let currentWidth = 0;
        console.log(groups)
        groups = groups.map(group=>{
          group.width = group.values.length;
          group.startPosition = currentWidth;
          currentWidth += group.width+groupPadding;
          return group;
        });

        const xScale = d3.scaleLinear()
            .domain([d3.min(groups, group => d3.min(group.values)), d3.max(groups, group => d3.max(group.values))]) 
            .range([margin.left, width - margin.right]); 

        const yScale = d3.scaleLinear()
            .domain([0, groups.length])  
            .range([0, height]);      

        const barGroups = svg.selectAll('.bar-group')
            .data(groups)
            .enter()
            .append('g')
            .classed('bar-group', true)
            .attr('transform', (group, index) => `translate(${margin.left}, ${yScale(index)})`); 

        barGroups.each(function(group) {
            const barGroup = d3.select(this);

            barGroup.selectAll('rect')
                .data(group.values)
                .enter()
                .append('rect')
                .attr('width', value => xScale(value)) 
                .attr('height', yScale(1))  
                .attr('x', 0)                   
                .attr('y', (value, i) => i * (yScale(1))); 
        });

        // Add a y-axis (for group names)
        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(yScale).tickFormat((d, i) => d.cluster))
            .attr('class', 'y-axis');
    
        
      }, [FCs]);
    
      return <div ref={svgContainerRef}></div>;

};
    
export default Contributions;