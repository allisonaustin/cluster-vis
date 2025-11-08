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

export default function MetricSelect({ selectedDims, headerMap, fcs, avgSeriesData, onMetricSelectChange }) {
    const features = Object.keys(headerMap);

    return (
        <List
        style={{ width: "100%", maxWidth: 300, overflowY: "scroll", maxHeight: 470 }}
        bordered
        dataSource={[...features].sort((a, b) => {
            const getMaxAbsContribution = (feature) => {
                const i = features.indexOf(feature);
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
            if (key === "cname_processed" || key === "cname_id") return null;
            
            const clusterSeries = avgSeriesData?.[key] || {};

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
                        <FeatureContributionBarGraph
                            graphId={`${key.replace(/\s/g, "_")}-feat-graph`}
                            feature={key}
                            fcData={
                                !fcs || features.indexOf(key) === -1 || features.indexOf(key) >= fcs.agg_feat_contrib_mat.length
                                ? []
                                : Object.keys(fcs.agg_feat_contrib_mat[features.indexOf(key)])
                                    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))) // sort cluster IDs numerically
                                    .map(clusterId => ({
                                        cluster: +clusterId,
                                        value: fcs.agg_feat_contrib_mat[features.indexOf(key)][+clusterId]
                                    }))
                            }
                            />
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                marginLeft: "5px",
                                gap: "4px",
                            }}
                        >
                            {Object.entries(clusterSeries).map(([clusterId, avgData]) => {
                                if (!avgData.length) return null;
                                const smooth = smoothSeries(avgData, 5, 40);
                                const minVal = Math.min(...smooth.map(d => d.value));
                                const maxVal = Math.max(...smooth.map(d => d.value));

                                return (
                                    <svg
                                        key={clusterId}
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
                                        stroke={colorScale(+clusterId)}
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