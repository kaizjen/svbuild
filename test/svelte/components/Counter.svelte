<script>
  import { Button } from "fluent-svelte";

  export let count = 0;

</script>

<Button on:click={ () => { count--; } }> - </Button>

<Button variant="accent" on:click={ () => { count = 0; } }>
  <b> {count} </b>
</Button>

<Button variant="hyperlink" on:click={ () => { count++; } }> + </Button>
