import React, { useContext, useEffect, useState } from 'react'
import { Store } from './index'
import { Polymath, browserUtils } from '@polymathnetwork/sdk'
import { Layout, Spin, Form, Input, Button, Divider, Select, message } from 'antd'
import useForm from 'rc-form-hooks'
import { filter } from 'p-iteration'

const { Option } = Select
const { Content } = Layout
const { Item } = Form
const networkConfigs = {
  1: {
    polymathRegistryAddress: '0xdfabf3e4793cd30affb47ab6fa4cf4eef26bbc27'
  },
  42: {
    polymathRegistryAddress: '0x5b215a7d39ee305ad28da29bf2f0425c6c2a00b3'
  },
  15: {
    polymathRegistryAddress: '0xdfabf3e4793cd30affb47ab6fa4cf4eef26bbc27'
  }
}

message.config({
  duration: 5000,
  maxCount: 1,
})

const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 8 },
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 16 },
  },
}

export const reducer = (state, action) => {
  console.log('ACTION', action)
  switch (action.type) {
  case 'INITALIZING':
    return {
      ...state,
      loading: true,
      loadingMessage: 'Initializing Polymath SDK',
      error: undefined,
    }
  case 'INITIALIZED':
    const { sdk, networkId, walletAddress } = action
    return {
      ...state,
      loading: false,
      loadingMessage: '',
      error: undefined,
      sdk,
      networkId,
      walletAddress
    }
  case 'FETCHING_RESERVATIONS':
    return {
      ...state,
      loading: true,
      loadingMessage: 'Fetching your previously reserved symbols',
      error: undefined,
    }
  case 'RESERVING_SYMBOL':
    return {
      ...state,
      loading: true,
      loadingMessage: 'Reserving symbol'
    }
  case 'RESERVED_SYMBOL':
    return {
      ...state,
      loading: true,
      reservations: undefined,
      loadingMessage: 'Refreshing reservations',
    }
  case 'FETCHED_RESERVATIONS':
    const { reservations } = action
    return {
      ...state,
      loading: false,
      loadingMessage: '',
      error: undefined,
      reservations
    }
  case 'ERROR':
    const { error } = action
    return {
      ...state,
      loading: false,
      loadingMessage: '',
      error,
    }
  default:
    throw new Error(`Unrecognized action type: ${action.type}`)
  }

}

function App() {
  const [state, dispatch] = useContext(Store)
  const { sdk, loading, loadingMessage, reservations, walletAddress } = state.AppReducer
  const [ formSymbolValue, setFormSymbolValue ] = useState('')

  const form = useForm()
  const { getFieldDecorator, setFieldsValue, resetFields, validateFields } = form
  // Initialize the SDK.
  useEffect(() => {
    async function init() {
      dispatch({type: 'INITALIZING'})

      try {
        const networkId = await browserUtils.getNetworkId()
        const walletAddress = await browserUtils.getCurrentAddress()
        if (![-1, 1, 42].includes(networkId)) {
          dispatch({
            type: 'ERROR',
            error: 'Please switch to either Main or Kovan network'
          })
          return
        }

        const config = networkConfigs[networkId]
        const sdk = new Polymath()
        await sdk.connect(config)
        dispatch({
          type: 'INITIALIZED',
          networkId,
          sdk,
          walletAddress,
        })
      }
      catch(error) {
        dispatch({
          type: 'ERROR',
          error: error.message
        })
      }
    }
    if (!sdk) {
      init()
    }
  }, [dispatch, sdk])

  // Fetch previous reservations if any.
  useEffect(() => {
    async function fetchReservations() {
      dispatch({ type: 'FETCHING_RESERVATIONS' })
      try {
        let reservations = await sdk.getSecurityTokenReservations({owner: walletAddress })
        console.log('All reservations', reservations)
        reservations = await filter(reservations, async (reservation) => {
          const launched = await reservation.isLaunched()
          return !launched
        })
        console.log('Not launched reservations', reservations)
        dispatch({type: 'FETCHED_RESERVATIONS', reservations})
      } catch (error) {
        dispatch({type: 'ERROR', error: error.message})
      }
    }
    if (sdk && walletAddress && reservations === undefined) {
      fetchReservations()
    }
  }, [dispatch, reservations, sdk, walletAddress])

  // @TODO refactor into an effect
  async function reserveSymbol() {
    if (formSymbolValue) {
      dispatch({type: 'RESERVING_SYMBOL'})
      try {
        const q = await sdk.reserveSecurityToken({symbol: formSymbolValue})
        const ret = await q.run()
        console.log('ret', ret)
        dispatch({type: 'RESERVED_SYMBOL'})
      } catch (error) {
        dispatch({type: 'ERROR', error: error.message})
        message.error(error.message)
      }
    } else {
      message.error('Please provide a symbol')
    }
  }

  return (
    <div>
      <Spin spinning={loading} tip={loadingMessage} size="large">
        <Layout>
          <Content style={{
            padding: 50,
            backgroundColor: '#FAFDFF'
          }}>
            <Form {...formItemLayout}>
              <Item>
                <Input
                  placeholder="SYMBOL"
                  value={formSymbolValue}
                  onChange={({ target: { value }}) => {
                    const pattern = RegExp('^[a-zA-Z0-9_-]*$')
                    if (pattern.test(value) && value.length <= 10) {
                      setFormSymbolValue(value.toUpperCase())
                    }
                  }}
                />
              </Item>
              <Button type="primary" onClick={reserveSymbol}>Reserve Symbol</Button>
            </Form>

            <Divider />

            {reservations &&
              <Form {...formItemLayout}>
                <Item>
                  <Select>
                    {reservations.map(({symbol}) =>
                      <Option key={symbol} value={symbol}>{symbol}</Option> )}
                  </Select>
                </Item>
                <Item label="Token Name">
                  <Input placeholder="Enter Token Name"/>
                </Item>
              </Form>
            }
          </Content>
        </Layout>
      </Spin>
    </div>
  )
}

export default App
