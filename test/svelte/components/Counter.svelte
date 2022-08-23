<script>
  import { Button } from "fluent-svelte";
  import { getContext } from "svelte"

  export let count = 0;

  let message = getContext('msg')
</script>

<Button on:click={ () => { count--; } }> - </Button>

<Button variant="accent" on:click={ () => { count = 0; } }>
  <b> {count} </b>
</Button>

<Button variant="hyperlink" on:click={ () => { count++; } }> + </Button>


Message: {message}