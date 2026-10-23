let csrfToken: string = null;

async function getCTRFToken() {
    const response = await fetch("/api/csrf-token", {
        method: "GET",
    });
    csrfToken = (await response.json()).token;
}

await getCTRFToken()

export default csrfToken
