<template>
  <div class="home">
    <div id="nav">
      <router-link to="/local">本地连接例子</router-link> |<br />
      <router-link to="/remote">远程连接视频</router-link> |<br />
      <router-link to="/some">多人连接例子</router-link>
    </div>
  </div>
</template>

<script>


export default {
  name: 'Home',
  components: {

  }
}
</script>
