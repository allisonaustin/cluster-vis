import { useEffect, useRef } from 'react';
import { getColor } from './colors.js';
import * as d3 from 'd3';

const LassoSelection = ({ svgRef, targetItems, onSelect }) => {
  useEffect(() => {
    const svg = d3.select(svgRef.current).select("svg");

    let coords = [];
    const lineGenerator = d3.line();
    const selectedIds = new Set();

    const pointInPolygon = (point, vs) => {
        // console.log(point, vs);
        // ray-casting algorithm based on
        // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html/pnpoly.html
        const x = point[0], y = point[1];
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];

        const intersect = (yi > y !== yj > y) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
        }
        return inside;
    };

    const drawPath = () => {
      d3.select("#lasso")
        .style("stroke", "black")
        .style("stroke-width", 2)
        .style("fill", "#34343454")
        .attr("d", lineGenerator(coords));
    };

    const dragStart = () => {
      coords = [];
      selectedIds.clear();
      svg.append('path')
        .attr('id', 'lasso');
      svg.selectAll(targetItems)
        .style('fill', getColor('default'))
        .style("opacity", 0.5);
    };

    function dragMove(event) {
        let mouseX = event.sourceEvent.offsetX;
        let mouseY = event.sourceEvent.offsetY;
        coords.push([mouseX, mouseY]);
        drawPath();
    }

    const dragEnd = () => {
        // Check if each point is inside the lasso
        let circles = svg.selectAll(targetItems)
        circles.each((d, i) => {
            let point = [
                +circles.nodes()[i].getAttribute('cx'),
                +circles.nodes()[i].getAttribute('cy')
            ];
            if (pointInPolygon(point, coords)) {
                selectedIds.add(d.Measurement);
            }
        });
        onSelect(Array.from(selectedIds));

        if (selectedIds.size == 0) { // resetting plot
            circles
                .style('fill', getColor('default'))
                .style("opacity", 1);
        }
        svg.select('#lasso').remove();
    };

    const drag = d3
        .drag()
        .on("start", dragStart)
        .on("drag", dragMove)
        .on("end", dragEnd);
    
    svg.call(drag);

    return () => {
      svg.on("mousedown", null).on("mousemove", null).on("mouseup", null);
    };
  }, [svgRef, targetItems, onSelect]);

  return null;
};

export default LassoSelection;
