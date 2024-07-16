import { writable } from "svelte/store";

const title = writable<String>("audiopub");
export default title;
