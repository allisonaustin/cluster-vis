export const dataConfigs = {
  "ganglia_2016-02-06.csv": {
    selectedPoints: ["novadaq-far-farm-06", "novadaq-far-farm-07","novadaq-far-farm-08", "novadaq-far-farm-09","novadaq-far-farm-10","novadaq-far-farm-12","novadaq-far-farm-130","novadaq-far-farm-131", "novadaq-far-farm-133","novadaq-far-farm-142","novadaq-far-farm-150", "novadaq-far-farm-16","novadaq-far-farm-164", "novadaq-far-farm-170","novadaq-far-farm-180","novadaq-far-farm-181","novadaq-far-farm-184", "novadaq-far-farm-189", "novadaq-far-farm-20","novadaq-far-farm-28", "novadaq-far-farm-35","novadaq-far-farm-59","novadaq-far-farm-61","novadaq-far-farm-78","novadaq-far-farm-92"],
    selectedDims: ["bytes_out", "cpu_idle", "cpu_nice", "cpu_system", "proc_run"],
    bStart: "2016-02-06 01:00:00Z",
    bEnd: "2016-02-06 03:00:00Z",
    nNeighbors: 15,
    minDist: 0.1,
    numClusters: 4
  },
  "ganglia_2024-02-21.csv": {
    selectedPoints: ["novadaq-far-farm-06", "novadaq-far-farm-07","novadaq-far-farm-08", "novadaq-far-farm-09","novadaq-far-farm-10","novadaq-far-farm-12","novadaq-far-farm-130","novadaq-far-farm-131", "novadaq-far-farm-133","novadaq-far-farm-142","novadaq-far-farm-150", "novadaq-far-farm-16","novadaq-far-farm-164", "novadaq-far-farm-170","novadaq-far-farm-180","novadaq-far-farm-181","novadaq-far-farm-184", "novadaq-far-farm-189", "novadaq-far-farm-20","novadaq-far-farm-28", "novadaq-far-farm-35","novadaq-far-farm-59","novadaq-far-farm-61","novadaq-far-farm-78","novadaq-far-farm-92"],
    selectedDims: ['bytes_out', 'cpu_idle', 'cpu_nice', 'cpu_system', 'mem_cached', 'mem_total', 'load_one'],
    bStart: "2024-02-21 18:47:30Z",
    bEnd: "2024-02-21 22:00:00Z",
    nNeighbors: 15,
    minDist: 0.1,
    numClusters: 4
  },
  "ganglia_2024-02-22.csv": {
    selectedPoints: ["novadaq-far-farm-06", "novadaq-far-farm-07","novadaq-far-farm-08", "novadaq-far-farm-09","novadaq-far-farm-10","novadaq-far-farm-12","novadaq-far-farm-130","novadaq-far-farm-131", "novadaq-far-farm-133","novadaq-far-farm-142","novadaq-far-farm-150", "novadaq-far-farm-16","novadaq-far-farm-164", "novadaq-far-farm-170","novadaq-far-farm-180","novadaq-far-farm-181","novadaq-far-farm-184", "novadaq-far-farm-189", "novadaq-far-farm-20","novadaq-far-farm-28", "novadaq-far-farm-35","novadaq-far-farm-59","novadaq-far-farm-61","novadaq-far-farm-78","novadaq-far-farm-92"],
    selectedDims: ['bytes_out', 'cpu_idle', 'cpu_nice', 'cpu_system', 'proc_run'],
    bStart: "2024-02-22 10:00:00Z",
    bEnd: "2024-02-22 12:00:00Z",
    nNeighbors: 15,
    minDist: 0.1,
    numClusters: 4
  },
  "env_logs_2018-06-09.csv": {
    selectedPoints: [
      "c0-0c0s0n0","c0-0c0s0n1","c0-0c0s0n2","c0-0c0s0n3","c0-0c0s1n2",
      "c0-0c0s7n1","c0-0c0s7n2","c0-0c0s7n3","c0-0c0s15n0","c0-0c0s15n1"
    ],
    selectedDims: ["P_VPP012_POUT", "I_VPP012_IOUT", "T_CPU0_TEMP"],
    bStart: "2018-06-09 09:00:00Z",
    bEnd: "2018-06-09 10:15:00Z",
    nNeighbors: 30,
    minDist: 0.3,
    numClusters: 5
  }
};

export const fileName = "ganglia_2024-02-21.csv";
export const headerFileName = "headers.json";