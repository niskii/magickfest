let token: string = null;

export async function getCTRFToken() {
    if (!token) {
        const response = await fetch("/api/csrf-token", {
            method: "GET",
        });
        if (!response.ok) return null;
        token = (await response.json()).token;
    }

    return token;
}
