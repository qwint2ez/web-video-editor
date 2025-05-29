export class ProjectSerializer {
    serialize(projectState) {
        try {
            return JSON.stringify(projectState, null, 2); // Pretty print JSON
        } catch (error) {
            console.error("Error serializing project state:", error);
            throw new Error("Could not serialize project state.");
        }
    }

    deserialize(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (typeof parsed !== 'object' || parsed === null) {
                throw new Error("Deserialized data is not a valid object.");
            }
            // Basic validation for top-level keys could be added here
            if (!parsed.videos || !Array.isArray(parsed.videos)) {
                 parsed.videos = []; // Ensure videos array exists
            }
            // Add more checks as needed
            return parsed;
        } catch (error) {
            console.error("Error deserializing project JSON:", error);
            throw new Error("Could not deserialize project JSON. Invalid format.");
        }
    }
}
