const response = await fetch("/api/csrf-token", {
    method: "GET",
});

let token: string = null;

if (response.ok) token = (await response.json()).token;

export default token;
