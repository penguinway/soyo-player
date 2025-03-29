import Vue from 'vue'

import Vuex from 'vuex'

import createLogger from "vuex/dist/logger"

import state from './state'

import * as getters from './getters'

import * as mutations from './mutations'

import * as actions from './actions'

// 导入快捷键模块
import shortcuts from './modules/shortcuts'

Vue.use(Vuex)

const debug = process.env.NODE_ENV !== "production"

export default new Vuex.Store({
    state,
    getters,
    mutations,
    actions,
    modules: {
        shortcuts
    }
    // strict: debug,
    // plugins: debug ? [createLogger()] : []
})