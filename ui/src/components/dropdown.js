import React, { useState, useEffect } from 'react';

const Dropdown = () => {
    const [files, setFiles] = useState([]);

    const [selectedFile, setSelectedFile] = useState('mgr/novadaq-far-mgr-01.json');

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await fetch('http://localhost:5009/files')
                const fileList = await response.json();
                setFiles(fileList);
            } catch (error) {
                console.error('Error fetching files:', error)
            }
        };
        fetchFiles();
    }, []);

    return (
        <div>
            <label htmlFor="Dropdown">Select file: </label>
            <select 
                id="dropdown"
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                >
                {files.map((file) => (
                    <option key={file} value={file}>
                        {file}
                    </option>
                ))}
            </select>
        </div>
    )
}

export default Dropdown;