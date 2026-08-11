export function timeConverter (time: number) {
    time = Math.round(time);
    return (
        Math.floor(time / 60 / 60)
            .toString()
            .padStart(2, "0") +
        ":" +
        (Math.floor(time / 60) % 60).toString().padStart(2, "0") +
        ":" +
        (Math.floor(time) % 60).toString().padStart(2, "0")
    );
};