import { watch } from "vue";
import { bootstrap } from "../bootstrap";


// TODO: refactor to somewhere else.

export default () => {
    watch(() => bootstrap.layout, (layout) => {
        const body = document.body
        switch (layout) {
            case 1: // pip
            if (bootstrap.platform == "desktop") {
                body.style.borderRadius = "8px"
            } else {
                body.style.borderRadius = "1.5em"
            }
            break;
            case 2: // grid
            body.style.borderRadius = "10px"
            break;
            default: // unhandled / focused
            body.style.borderRadius = "0"
        }
    })
}