export class ProjectSerializer {
    serialize(projectState, format = 'json') {
        try {
            if (format === 'xml') {
                const doc = document.implementation.createDocument(null, "project", null);
                const projectNode = doc.documentElement;
                projectNode.setAttribute("version", projectState.version || "1.0");

                const videosNode = doc.createElement("videos");
                projectState.videos?.forEach(video => {
                    const videoNode = doc.createElement("video");
                    Object.entries(video).forEach(([key, value]) => {
                        if (value !== undefined && value !== null) {
                            const elem = doc.createElement(key);
                            elem.textContent = String(value);
                            videoNode.appendChild(elem);
                        }
                    });
                    videosNode.appendChild(videoNode);
                });
                projectNode.appendChild(videosNode);

                if (projectState.audio) {
                    const audioNode = doc.createElement("audio");
                    Object.entries(projectState.audio).forEach(([key, value]) => {
                        if (value !== undefined && value !== null) {
                            const elem = doc.createElement(key);
                            elem.textContent = String(value);
                            audioNode.appendChild(elem);
                        }
                    });
                    projectNode.appendChild(audioNode);
                }

                if (projectState.filter) {
                    const filterNode = doc.createElement("filter");
                    if (projectState.filter.name) {
                        filterNode.setAttribute("name", projectState.filter.name);
                    }
                    projectNode.appendChild(filterNode);
                }

                if (projectState.text) {
                    const textNode = doc.createElement("textOverlay"); // Changed from "text"
                    Object.entries(projectState.text).forEach(([key, value]) => {
                         if (value !== undefined && value !== null) {
                            const elem = doc.createElement(key === 'text' ? 'content' : key); // Use <content> for the text string
                            elem.textContent = String(value);
                            textNode.appendChild(elem);
                        }
                    });
                    projectNode.appendChild(textNode);
                }

                const serializer = new XMLSerializer();
                return serializer.serializeToString(doc);

            } else { // Default to JSON
                return JSON.stringify(projectState, null, 2);
            }
        } catch (error) {
            console.error(`Error serializing project to ${format}:`, error);
            throw new Error(`Could not serialize project to ${format}.`);
        }
    }

    deserialize(data, format = 'json') {
        try {
            if (format === 'xml') {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(data, "application/xml");

                if (xmlDoc.getElementsByTagName("parsererror").length) {
                    throw new Error("XML parsing error.");
                }

                const projectNode = xmlDoc.documentElement;
                const projectState = {
                    version: projectNode.getAttribute("version") || "1.0",
                    videos: [],
                    audio: null,
                    filter: null,
                    text: null,
                };

                const videosNode = projectNode.querySelector("videos");
                videosNode?.querySelectorAll("video").forEach(videoNode => {
                    const video = {};
                    videoNode.childNodes.forEach(child => {
                        if (child.nodeType === Node.ELEMENT_NODE) {
                            const key = child.tagName;
                            const value = child.textContent;
                            if (key === "isTrimmed") video[key] = value === 'true';
                            else if (key === "trimStart" || key === "trimEnd") video[key] = parseFloat(value);
                            else video[key] = value;
                        }
                    });
                    projectState.videos.push(video);
                });

                const audioNode = projectNode.querySelector("audio");
                if (audioNode) {
                    projectState.audio = {};
                    audioNode.childNodes.forEach(child => {
                        if (child.nodeType === Node.ELEMENT_NODE) {
                             projectState.audio[child.tagName] = child.textContent;
                        }
                    });
                }

                const filterNode = projectNode.querySelector("filter");
                if (filterNode && filterNode.hasAttribute("name")) {
                    projectState.filter = { name: filterNode.getAttribute("name") };
                }

                const textNode = projectNode.querySelector("textOverlay"); // Changed from "text"
                if (textNode) {
                    projectState.text = {};
                    textNode.childNodes.forEach(child => {
                        if (child.nodeType === Node.ELEMENT_NODE) {
                            const key = child.tagName === 'content' ? 'text' : child.tagName; // Map <content> back to 'text'
                            projectState.text[key] = child.textContent;
                        }
                    });
                }
                return projectState;

            } else { // Default to JSON
                return JSON.parse(data);
            }
        } catch (error) {
            console.error(`Error deserializing project ${format}:`, error, data.substring(0,100));
            throw new Error(`Could not deserialize project ${format}. Invalid format or content.`);
        }
    }
}
