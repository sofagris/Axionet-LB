from app.plugins.haproxy.metrics import aggregate_runtime_rows
from app.plugins.haproxy.runtime import HaproxyRuntimeClient


CSV_SAMPLE = """\
# pxname,svname,qcur,qmax,scur,smax,slim,stot,bin,bout,dreq,dresp,ereq,econ,eresp,wretr,wredis,status,weight,act,bck,chkfail,chkdown,lastchg,downtime,qlimit,pid,iid,sid,throttle,lbtot,tracked,type,rate,rate_lim,rate_max,check_status,check_code,check_duration,hrsp_1xx,hrsp_2xx,hrsp_3xx,hrsp_4xx,hrsp_5xx,hrsp_other,hanafail,req_rate,req_rate_max,req_tot,cli_abrt,srv_abrt,comp_in,comp_out,comp_byp,comp_rsp,lastsess,last_chk,last_agt,qtime,ctime,rtime,ttime,
stats,FRONTEND,,,1,5,2000,100,1000,2000,0,0,2,,,,,OPEN,,,,,,,,,1,1,0,,,,0,3,0,0,,,,,,,,,,,0,0,0,,,0,0,0,0,,,,,,,,
main,FRONTEND,,,4,10,2000,500,9000,8000,0,0,1,,,,,OPEN,,,,,,,,,1,2,0,,,,0,7,0,0,,,,,,,,,,,0,0,0,,,0,0,0,0,,,,,,,,
app,BACKEND,0,0,4,10,200,500,9000,8000,0,0,,3,1,0,0,UP,0,0,0,,0,1,0,,1,3,0,,0,,1,0,,0,,,,0,0,0,0,0,0,,,,0,0,0,0,0,0,,,,,0,,,0,0,0,0,
app,s1,0,0,3,8,,400,7000,6000,,0,,0,0,0,0,UP,100,1,0,0,0,1,0,,1,3,1,,0,,2,0,,0,L4OK,,0,0,0,0,0,0,0,0,,,,0,0,,,,,0,,,0,0,0,0,
app,s2,0,0,0,0,,0,0,0,,0,,1,2,0,0,DOWN,100,1,0,0,1,1,30,,1,3,2,,0,,2,0,,0,L4TOUT,,0,0,0,0,0,0,0,0,,,,0,0,,,,,0,,,0,0,0,0,
"""


def test_aggregate_runtime_rows_from_frontends() -> None:
    client = HaproxyRuntimeClient(docker=object())  # type: ignore[arg-type]
    rows = client.parse_stats(CSV_SAMPLE)
    agg = aggregate_runtime_rows(rows)
    assert agg.frontend_count == 2
    assert agg.backend_count == 1
    assert agg.current_sessions == 5
    assert agg.total_sessions == 600
    assert agg.session_rate == 10
    assert agg.bytes_in == 10_000
    assert agg.bytes_out == 10_000
    assert agg.request_errors == 3
    assert agg.connection_errors == 3
    assert agg.response_errors == 1
    assert agg.servers_total == 2
    assert agg.servers_up == 1
    assert agg.servers_down == 1
