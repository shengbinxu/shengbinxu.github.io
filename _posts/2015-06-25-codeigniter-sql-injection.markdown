---
layout: post
category : php
tagline: "Supporting tagline"
tags : [codeigniter,sql injection]
---

### sql注入

#### 一直以来都了解一些sql注入的方法，如在参数中加入引号可以导致sql注入，今天在codeigniter框架中实践了下：

{% highlight php startinline %}
    //p= "42 or '1=1'"
    $p = $this->input->get('p');
    //原生的mysqli。sql会注入:返回表中的所有数据
    $data = $db->query("select * from baoxian_baodan_record where id=" . $p)->fetch_all();
    print_r($data);
    //PDO.sql会注入:返回表中的所有数据
    $db = new PDO('mysql:dbname=app_welfare_huodong','root','');
    $db->query("select * from baoxian_baodan_record where id=" . $p)->fetchAll();
    print_r($data);
    //codeigniter的db类CI_DB_mysqli_driver。sql也会注入
    //本以为CI框架肯定对sql注入做了处理，不论怎样的写法，都不会导致sql注入，但是，还是注入了。
    $data = $this->db->query("select * from baoxian_baodan_record where id=" . $p)->result_array();
    print_r($data);
    //codeigniter的db类CI_DB_mysqli_driver。sql不会注入。只返回id=42的一行记录
    $data = $this->db->where('id',$p)->get('baoxian_baodan_record')->result_array();
    print_r($data);
    die();
{% endhighlight %}

#### 结论：不管是使用mysqli、pdo 或者ci中的db类，尽量不要采用sql拼接的方法。而是要采用采用参数绑定（如pdo中的prepare）。
