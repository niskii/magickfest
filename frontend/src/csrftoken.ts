export async function getCSRFToken() {
    const response = await fetch("/api/csrf-token", {
        method: "GET",
    });
    return (await response.json()).token;
}
