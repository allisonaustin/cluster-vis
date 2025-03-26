import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';

const Contributions = ({ data, FCs }) => {
    const svgContainerRef = useRef();
    const [size,] = useState({ width: 400, height: 450 });
    
    useEffect(() => {
      if (!svgContainerRef.current || !FCs || !data) return; 
        const margin = { top: 30, right: 10, bottom: 0, left: 20 };
        const width = size.width;
        const height = size.height;

        const agg_feat_contrib_mat = FCs.agg_feat_contrib_mat
        const label_to_rep_row = FCs.label_to_rep_row
        const label_to_rows = FCs.label_to_rows
        const numRows = agg_feat_contrib_mat.length; // features
        const numCols = agg_feat_contrib_mat[0].length; // clusters
        const maxContrib = d3.max(agg_feat_contrib_mat.flatMap(row => row));
        const minContrib = d3.min(agg_feat_contrib_mat.flatMap(row => row));

        const excludeFeatures = ["Cluster", "nodeId", "PC1", "PC2", "UMAP1", "UMAP2", "tSNE1", "tSNE2"]
        const xlabel_names = FCs.order_col;
        const ylabel_names = Object.keys(data[0]).filter(
            key => !excludeFeatures.includes(key)
        );
        
        const transformedData = xlabel_names.reduce((results, cluster, clusterIndex) => {
            const clusterValues = agg_feat_contrib_mat.map(row => row[clusterIndex]);
            const filteredData = clusterValues
                .map((value, rowIndex) => ({ value, featureName: ylabel_names[rowIndex], cluster: cluster }))
                .filter(d => d.value < -0.5 || d.value > 0.5);
        
            return [...results, 
                {
                    clusterId: cluster,  
                    data: filteredData.map(d => ({feature: d.featureName, value: d.value})),
                }
            ];
        }, []);
        const uniqueFeatures = Array.from(new Set(transformedData.flatMap(cluster => cluster.data.map(d => d.feature))));
        const featureColorScale = d3.scaleOrdinal()
            .domain(uniqueFeatures)
            .range(uniqueFeatures.map((_, i) => d3.interpolateSinebow(i / uniqueFeatures.length)));

        const xDomain = [-1, 1];
        const xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([margin.left, width - margin.right]); 
        
        const svg = d3.select(svgContainerRef.current)
            .append("svg")
            .attr('id', `matrix-svg`)
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${size.width} ${size.height + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        svg.append('g')
            .attr('transform', `translate(0, ${margin.top})`)
            .call(d3.axisTop(xScale));

        // (Total graph height - margin top - margin bottom) = total padding between groups + total height of all bars
        // (Total graph height - margin top - margin bottom) = padding * (nGroups - 1) + barHeight * nBars
        // (Total graph height - margin top - margin bottom) = (barHeight * 1.5) * (nGroups - 1) + barHeight * nBars
        // (Total graph height - margin top - margin bottom) = barHeight * (1.5 * (nGroups - 1) + nBars)
        // barHeight = (Total graph height - margin top - margin bottom) / (1.5 * (nGroups - 1) + nBars)
        const nTotalBars = transformedData.reduce((count, cluster) => count + cluster.data.length, 0 )
        const PADDING_MULTIPLIER = 0.5 // Padding between groups as a multiplier of bar height
        const barHeight = (height - margin.top - margin.bottom) / (PADDING_MULTIPLIER * (transformedData.length - 1) + nTotalBars)

        let yOffset = margin.top;
        transformedData.forEach((cluster, i) => {
            console.log(cluster)
            // Construct a new y axis per cluster
            const y = d3.scaleBand()
                .domain(cluster.data.map(d => d.feature))
                .range([0, barHeight * cluster.data.length - 1])
                .paddingOuter(0.1)
                .paddingInner(0.1);
            

            // Plot bars for cluster.
            svg.append('g')
            .selectAll()
            .data(cluster.data)
            .join('rect')
                .attr('x', d => d.value >= 0 ? xScale(0) : xScale(d.value))
                .attr('y', (d,i) => yOffset + y(d.feature))
                .attr('width', d => Math.abs(xScale(d.value) - xScale(0)))
                .attr('height', (d,i) => y.bandwidth())
                .attr('fill', d => featureColorScale(d.feature)) // TODO: color by
                .attr('opacity', 0.85)
                .append('title').text((d,i) => `${d.feature}: ${d.value}`)
            
            svg.append('g')
                .attr('transform', `translate(${(size.width - margin.left - margin.right) / 2 + margin.left}, ${yOffset})`)
                // Swap to commented version for left aligned axis
                // .attr('transform', `translate(${margin.left / 4}, ${yOffset})`)
                .call(d3.axisRight(y).tickSizeOuter(0).tickSizeInner(0));
            svg.append('text')
                .attr('class', 'cluster-title')
                .attr('text-anchor', 'center')
                .attr('transform', 'rotate(-90)')
                .attr('y', (size.width - margin.left - margin.right) / 2 + margin.left - 6)
                // Swap to commented version for left aligned axis
                // .attr('y', margin.left / 6)
                .attr('x', -(yOffset + (barHeight * cluster.data.length + barHeight * PADDING_MULTIPLIER) / 2))
                .attr('font-weight', 'bold')
                .text(`c${cluster.clusterId}`)                

            yOffset += barHeight * cluster.data.length + barHeight * PADDING_MULTIPLIER;
        });

        // Uncomment for additional center axis line
        // svg.append('line')
        //     .attr('x1', (size.width - margin.left - margin.right) / 2 + margin.left)
        //     .attr('x2', (size.width - margin.left - margin.right) / 2 + margin.left)
        //     .attr('y1', margin.top)
        //     .attr('y2', height - margin.bottom)
        //     .attr('stroke', 'black')
        //     .attr('stroke-width', 1)

        // Define the drop shadow filter
        const defs = svg.append("defs");

        const filter = defs.append("filter")
            .attr("id", "white-shadow")
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "150%")
            .attr("height", "150%");

        filter.append("feDropShadow")
            .attr("dx", 0)
            .attr("dy", 0)
            .attr("stdDeviation", 4) // Blurriness of the shadow
            .attr("flood-color", "white") // Shadow color
            .attr("flood-opacity", 0.75); // Fully visible white shadow

        // Apply the filter to tick labels
        svg.selectAll(".tick text")
            .attr("filter", "url(#white-shadow)")
            .style("fill", "black"); // Ensure text color remains black (or your original color);

        svg.selectAll(".tick text")
            .attr("filter", "url(#white-shadow)")
            .style("fill", "black"); // Ensure text color remains black (or your original color);
        
        svg.selectAll(".cluster-title")
            .attr("filter", "url(#white-shadow)")
            .style("fill", "black"); // Ensure text color remains black (or your original color);


      }, [FCs]);
    
      return <div ref={svgContainerRef}></div>;

};
    
export default Contributions;