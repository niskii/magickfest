const response = await fetch("/api/csrf-token", {
    method: "GET",
});

const token = (await response.json()).token;

export default token;
