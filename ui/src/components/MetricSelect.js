import { Checkbox, List } from "antd";
import React from 'react';
import FeatureContributionBarGraph from "./FeatureContributionBarGraph";
import { colorScale } from '../utils/colors.js';

function smoothSeries(series, windowSize = 5, maxPoints = 40) {
  if (series.length === 0) return [];

  const smoothed = series.map((d, i) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(series.length, i + windowSize);
    const slice = series.slice(start, end);
    const avg = slice.reduce((a, b) => a + b.value, 0) / slice.length;
    return { timestamp: d.timestamp, value: avg };
  });

  if (smoothed.length > maxPoints) {
    const step = Math.floor(smoothed.length / maxPoints);
    return smoothed.filter((_, i) => i % step === 0);
  }

  return smoothed;
}

export default function MetricSelect({ data, selectedDims, featureData, nodeClusterMap, fcs, onMetricSelectChange }) {

  return (
    <List
      style={{ width: "100%", maxWidth: 300, overflowY: "scroll", maxHeight: 390 }}
      bordered
      dataSource={[...data.features].sort((a, b) => {
        const getMaxAbsContribution = (feature) => {
            const i = data.features.indexOf(feature);
            if (!fcs || i === -1 || i >= fcs.agg_feat_contrib_mat.length) return -Infinity;
            return Math.max(...fcs.agg_feat_contrib_mat[i].map(v => Math.abs(v)));
        };

        const aSelected = selectedDims.includes(a);
        const bSelected = selectedDims.includes(b);

        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;

        const aFC = getMaxAbsContribution(a);
        const bFC = getMaxAbsContribution(b);

        return bFC - aFC;
    })}
      renderItem={(key, index) => {
        const clusterSeries = fcs
            ? fcs.order_col.map(clusterId => {
                const clusterNodes = Array.from(nodeClusterMap.entries())
                .filter(([_, cid]) => cid === clusterId)
                .map(([nid]) => nid);

                const series = featureData[key] || [];

                const tsMap = new Map();
                series.forEach(d => {
                if (clusterNodes.includes(d.nodeId)) {
                    const t = +d.timestamp; 
                    if (!tsMap.has(t)) tsMap.set(t, []);
                    tsMap.get(t).push(d.value);
                }
                });

                const avgSeries = Array.from(tsMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([t, vals]) => ({
                    timestamp: new Date(t),
                    value: vals.reduce((a, b) => a + b, 0) / vals.length
                }));

                return avgSeries;
            })
            : [];

        return (
            <List.Item key={key} style={{ display: "flex", alignItems: "flex-start", padding: "5px 10px" }}>
            
            <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1}}>
                <div style={{display: 'flex', alignItems: "center" }}>
                    <Checkbox
                        // TODO: refactor checkbox state so FeatureContributionBarGraph doesn't rerender on checkbox change
                        checked={selectedDims.includes(key)}
                        onChange={() => onMetricSelectChange(key)}
                        style={{ marginRight: "10px" }}
                    />
                    <span 
                        style={{ 
                            flexGrow: 1, 
                            whiteSpace: "nowrap", 
                            overflow: "hidden", 
                            textOverflow: "ellipsis" 
                        }}>
                        {key}
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "row", marginTop: "4px" }}>
                    <FeatureContributionBarGraph graphId={`${key.replace(/\s/g, "_")}-feat-graph`} feature={key}
                        //TODO: fix issue with less FCs than available data features
                        fcData={!fcs || data.features.indexOf(key) === -1 || data.features.indexOf(key) >= fcs.agg_feat_contrib_mat.length ? []
                                    : fcs.order_col.map(clusterId => ({
                                        cluster: clusterId,
                                        value: fcs.agg_feat_contrib_mat[data.features.indexOf(key)][clusterId]
                                    }))}
                    />
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            marginLeft: "5px",
                            gap: "4px",
                        }}
                    >
                        {clusterSeries.map((avgData, ci) => {
                            const clusterId = fcs.order_col[ci];
                            if (!avgData.length) return null;

                            const smooth = smoothSeries(avgData, 5, 40);
                            const minVal = Math.min(...smooth.map((d) => d.value));
                            const maxVal = Math.max(...smooth.map((d) => d.value));

                            return (
                                <svg
                                    key={ci}
                                    width={60}
                                    height={20}
                                    style={{
                                    border: "1px solid #eee",
                                    borderRadius: "2px",
                                    background: "#fafafa",
                                    }}
                                >
                                <polyline
                                    fill="none"
                                    stroke={colorScale(clusterId)}
                                    strokeWidth={1.5}
                                    points={smooth
                                        .map((d, i) => {
                                        const x = (i / (smooth.length - 1)) * 60;
                                        const y =
                                            20 - ((d.value - minVal) / ((maxVal - minVal) || 1)) * 20;
                                        return `${x},${y}`;
                                        })
                                        .join(" ")}
                                />
                            </svg>
                            );
                        })}
                        </div>
                    </div>
                </div>
            </List.Item>
        );
      }}
    />
  )
}

export const MemoMetricSelect = React.memo(MetricSelect, (prev, next) => {
    return prev.data === next.data &&
           prev.nodeClusterMap === next.nodeClusterMap &&
           prev.fcs === next.fcs &&
           prev.selectedDims === next.selectedDims;
});