import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { LocaleProvider, Card, Table } from 'antd';
import zhCN from 'antd/lib/locale-provider/zh_CN';
import 'moment/locale/zh-cn';
import { LocalForage, LocalStorage } from './services';
import {
  generateStateOfColumns,
  generateStateOfPagination,
  generateStateOfSearch,
  generateSearchQuery
} from './utils';
import TablexSearch from './components/TablexSearch';
import TablexError from './components/TablexError';
import ManageSettings from './components/ManageSettings';
import ManageRefresh from './components/ManageRefresh';
import {
  defaultLocalLangKey,
  defaultColumnsKeyOfDB,
  defaultConfigsKeyOfDB,
  defaultLocalConfigs
} from './constants';

function noop() {}

export default class TableX extends React.Component {
  static propTypes = {
    name: PropTypes.string,
    columns: PropTypes.array,
    dataSource: PropTypes.array,
    tableRowKey: PropTypes.func,
    tableTitle: PropTypes.oneOfType([
      PropTypes.node,
      PropTypes.string
    ]),
    tableProps: PropTypes.any,
    showPagination: PropTypes.bool,
    paginationTotal: PropTypes.number,
    showSearch: PropTypes.bool,
    searchOptions: PropTypes.array,
    searchRealTime: PropTypes.bool,
    loading: PropTypes.bool,
    onChange: PropTypes.func,
    errorMessage: PropTypes.string,
    locale: PropTypes.string
  };

  static defaultProps = {
    name: 'TableX',
    columns: [],
    dataSource: [],
    tableRowKey: noop,
    tableTitle: null,
    tableProps: {},
    showPagination: true,
    paginationTotal: 0,
    showSearch: true,
    searchOptions: [],
    searchRealTime: true,
    loading: false,
    onChange: noop,
    errorMessage: '',
    locale: 'enUS'
  };

  constructor(props) {
    super(props);
    this.onTableChange = this.onTableChange.bind(this);
    this.onSearchChange = this.onSearchChange.bind(this);
    this.onFetchData = this.onFetchData.bind(this);
    this.resetLang = this.resetLang.bind(this);
    this.resetLocalSettings = this.resetLocalSettings.bind(this);
  }

  state = {
    useLocal: false,
    filterColumns: [],
    localColumns: [],
    pagination: false,
    searchItems: [],
    searchQuery: [],
    realTime: true,
    localConfigs: {},
    lang: 'enUS'
  };

  componentWillMount() {
    this.onInitWithoutLocal();
  }

  componentDidMount() {
    this.onInitLocal();
  }

  onInitWithoutLocal() {
    const {
      columns, showPagination, paginationTotal,
      showSearch, searchOptions, searchRealTime, locale
    } = this.props;

    const { filterColumns, localColumns } = generateStateOfColumns(columns);
    const { pagination } = generateStateOfPagination(showPagination, paginationTotal);
    const { searchItems, searchQuery, realTime } = generateStateOfSearch(showSearch, searchOptions, searchRealTime);
    const localConfigs = { ...defaultLocalConfigs };

    this.setState({
      filterColumns,
      localColumns,
      pagination,
      searchItems,
      searchQuery,
      realTime,
      localConfigs,
      lang: locale
    });
  }

  onInitLocal() {
    const {
      name, columns, showPagination, paginationTotal,
      showSearch, searchOptions, searchRealTime, locale
    } = this.props;
    this.storageService = new LocalStorage();
    const useLocal = Boolean(this.storageService.get(`tablex-${name}`));
    const lang = this.storageService.get(defaultLocalLangKey) || locale;
    this.onLangChange(lang);
    this.dbOfColumns = new LocalForage(defaultColumnsKeyOfDB);
    this.dbOfConfigs = new LocalForage(defaultConfigsKeyOfDB);
    if (useLocal) {
      Promise.all([
        this.dbOfColumns.get(name),
        this.dbOfConfigs.get(name)
      ])
        .then(([preLocalColumns, preLocalConfigs]) => {
          const { filterColumns, localColumns } = generateStateOfColumns(columns, preLocalColumns);
          const { pagination } = generateStateOfPagination(showPagination, paginationTotal, preLocalConfigs);
          const { searchItems, searchQuery, realTime } = generateStateOfSearch(showSearch, searchOptions, searchRealTime, preLocalConfigs);
          const localConfigs = preLocalConfigs || { ...defaultLocalConfigs };
          this.setState({
            useLocal,
            filterColumns,
            localColumns,
            pagination,
            searchItems,
            searchQuery,
            realTime,
            localConfigs
          });
        });
    }
  }

  onTableChange(pagination, filters, sorter, extra) {
    const { onChange } = this.props;
    const { searchItems } = this.state;
    const searchQuery = generateSearchQuery(searchItems);
    this.setState({
      searchQuery, pagination, filters, sorter, extra
    }, () => {
      onChange(searchQuery, pagination, filters, sorter, extra);
    });
  }

  onSearchChange(newSearchItems, searchNow = false) {
    const { onChange, showPagination } = this.props;
    const { pagination: oldPagination } = this.state;
    const searchQuery = generateSearchQuery(newSearchItems);
    this.setState({ searchItems: newSearchItems, searchQuery }, () => {
      if (searchNow) {
        let pagination = false;
        if (showPagination) {
          pagination = Object.assign({}, oldPagination, {
            current: 1
          });
        }
        this.setState({ pagination }, () => {
          onChange(searchQuery, pagination, {}, {}, {});
        });
      }
    });
  }

  onFetchData() {
    const { onChange } = this.props;
    const {
      searchQuery, pagination, filters, sorter, extra
    } = this.state;
    onChange(searchQuery, pagination, filters, sorter, extra);
  }

  onLangChange(lang) {
    this.setState({ lang }, () => {
      switch (lang) {
        case 'enUS':
          moment.locale('en');
          break;
        case 'zhCN':
          moment.locale('zh-cn');
          break;
        default:
          break;
      }
    });
  }

  toggleLocalSwitch() {
    const { useLocal } = this.state;
    this.setState({ useLocal: !useLocal });
  }

  resetLang(lang) {
    if (!lang || lang === 'enUS') {
      this.storageService.remove(defaultLocalLangKey);
    } else {
      this.storageService.set(defaultLocalLangKey, lang);
    }

    this.onLangChange(lang);
  }

  resetLocalSettings(type, values, useLocal) {
    const { columns, name } = this.props;
    switch (type) {
      case 'all': {
        const { filterColumns, localColumns } = generateStateOfColumns(columns);
        this.setState({
          useLocal,
          filterColumns,
          localColumns,
          localConfigs: { ...defaultLocalConfigs }
        }, () => {
          if (useLocal) {
            this.storageService.set(`tablex-${name}`, 'true');
          } else {
            this.dbOfConfigs.remove(name);
            this.dbOfColumns.remove(name);
            this.storageService.remove(`tablex-${name}`);
          }
        });
        break;
      }
      case 'configs':
        this.setState({
          realTime: values.realTime,
          localConfigs: values
        }, () => {
          this.dbOfConfigs.set(name, values);
        });
        break;
      case 'columns': {
        const { filterColumns, localColumns } = generateStateOfColumns(columns, values);
        this.setState({
          filterColumns,
          localColumns
        }, () => {
          this.dbOfColumns.set(name, localColumns);
        });
        break;
      }
      default:
        break;
    }
  }

  render() {
    const {
      dataSource, tableRowKey, tableTitle, tableProps: tableOtherProps,
      showPagination, paginationTotal,
      showSearch, searchOptions, loading, errorMessage
    } = this.props;
    const {
      useLocal, filterColumns, localColumns, pagination, localConfigs,
      searchItems, searchQuery, realTime, lang
    } = this.state;

    const { bordered, size } = localConfigs;
    const rowKey = (tableRowKey === noop) ? (t => (t[filterColumns[0].dataIndex])) : tableRowKey;
    const language = (lang === 'enUS') ? undefined : zhCN;
    if (showPagination && pagination) {
      Object.assign(pagination, { total: paginationTotal });
    }

    const manager = (
      <div>
        <ManageRefresh
          iconType="reload"
          handleClick={this.onFetchData}
        />
        <ManageSettings
          iconType="setting"
          lang={lang}
          useLocal={useLocal}
          showSearch={showSearch}
          localConfigs={localConfigs}
          localColumns={localColumns}
          resetLang={this.resetLang}
          resetLocalSettings={this.resetLocalSettings}
        />
      </div>
    );

    return (
      <LocaleProvider locale={language}>
        <div className="ant-table-x">
          {showSearch && (
            <TablexSearch
              lang={lang}
              realTime={realTime}
              searchOptions={searchOptions}
              searchItems={searchItems}
              searchQuery={searchQuery}
              onChange={this.onSearchChange}
            />
          )}
          <TablexError
            errorMessage={errorMessage}
            handleClick={this.onFetchData}
          />
          <Card
            title={tableTitle}
            extra={manager}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              dataSource={dataSource}
              columns={filterColumns}
              pagination={pagination}
              loading={loading}
              rowKey={rowKey}
              onChange={this.onTableChange}
              bordered={bordered}
              size={size}
              {...tableOtherProps}
            />
          </Card>
        </div>
      </LocaleProvider>
    );
  }
}
